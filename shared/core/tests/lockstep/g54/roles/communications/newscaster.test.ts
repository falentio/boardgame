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
    hand: ["newscaster", "banker"],
    lieHand: ["banker", "banker"],
    coins: 4,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "keep", "turn"],
        coins: { ann: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "keep", "turn"],
        coins: { ann: -1 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("newscaster", record);

test("Newscaster: pay 1, draw 3, return 3", () => {
  let state = withCoins(
    craftSet(commsSet("newscaster"), [[ANN, ["newscaster", "banker"]]], "newscaster-action"),
    ANN,
    3,
  );
  const before = totalCards(state);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "newscaster", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(openPurpose(state)).toBe("keep");
  expect(state.draw?.pool).toHaveLength(3);
  // Keep two cards from the pool; the rest return to the Court.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [2, 3] } : null));
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(totalCards(state)).toBe(before);
});

test("Newscaster: a successful challenge makes the claimant lose a life and the draw fail", () => {
  let state = withCoins(
    craftSet(commsSet("newscaster"), [[ANN, ["banker", "banker"]]], "newscaster-lie"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "newscaster", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(3);
});

test("Newscaster: a failed challenge costs the challenger a life, then the swap resolves", () => {
  let state = withCoins(
    craftSet(commsSet("newscaster"), [[ANN, ["newscaster", "banker"]]], "newscaster-true"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "newscaster", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("keep");
});

test("Newscaster: a short Court clamps the draw while the paid coin stays paid", () => {
  let state = withCourt(
    withCoins(
      craftSet(commsSet("newscaster"), [[ANN, ["newscaster", "banker"]]], "newscaster-short"),
      ANN,
      3,
    ),
    ["banker"],
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "newscaster", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("keep");
  expect(state.draw?.pool).toHaveLength(1);
  expect(state.draw?.keepSize).toBe(2);
  expect(rawCoins(state, ANN)).toBe(2);
});
