import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  rawHand,
  totalCards,
  withCoins,
  withCourt,
  type RoleId,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";

/** A three-seat set whose Communications role is the one under test. */
const commsSet = (comms: RoleId): readonly RoleId[] => [
  "banker",
  comms,
  "guerrilla",
  "peacekeeper",
  "politician",
];

const record: RoleRecord = {
    hand: ["writer", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "writer-draw", "keep", "turn"],
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "writer-draw", "keep", "turn"],
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("writer", record);

test("Writer: draw 1 free, pay 1 per extra draw, then return the same number", () => {
  let state = withCoins(
    craftSet(commsSet("writer"), [[ANN, ["writer", "banker"]]], "writer-action"),
    ANN,
    3,
  );
  const before = totalCards(state);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "writer", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("writer-draw");
  expect(state.draw?.pool).toHaveLength(1);
  // Pay for two more draws, then stop.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "pay" } : null));
  expect(state.draw?.pool).toHaveLength(2);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "pay" } : null));
  expect(state.draw?.pool).toHaveLength(3);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(1);
  expect(openPurpose(state)).toBe("keep");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [0, 1] } : null));
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(totalCards(state)).toBe(before);
});

test("Writer: a successful challenge makes the claimant lose a life and the dig fail", () => {
  let state = craftSet(commsSet("writer"), [[ANN, ["banker", "banker"]]], "writer-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "writer", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(openPurpose(state)).toBe("turn");
});

test("Writer: a drained Court stops the pay window mid-dig without refunding", () => {
  let state = withCourt(
    withCoins(
      craftSet(commsSet("writer"), [[ANN, ["writer", "banker"]]], "writer-drain"),
      ANN,
      4,
    ),
    ["banker", "banker"],
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "writer", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("writer-draw");
  expect(state.draw?.pool).toHaveLength(1);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "pay" } : null));
  expect(state.draw?.pool).toHaveLength(2);
  expect(state.court).toHaveLength(0);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "pay" } : null));
  expect(openPurpose(state)).toBe("keep");
  expect(state.draw?.pool).toHaveLength(2);
  expect(rawCoins(state, ANN)).toBe(3);
});

test("Writer: a failed challenge costs the challenger a life, then the dig opens", () => {
  let state = craftSet(commsSet("writer"), [[ANN, ["writer", "banker"]]], "writer-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "writer", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("writer-draw");
});
