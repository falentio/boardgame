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
    hand: ["reporter", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "keep", "turn"],
        coins: { ann: 1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "keep", "turn"],
        coins: { ann: 1 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("reporter", record);

test("Reporter: take 1 coin, draw 1, return 1", () => {
  let state = craftSet(commsSet("reporter"), [[ANN, ["reporter", "banker"]]], "reporter-action");
  const before = totalCards(state);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "reporter", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(openPurpose(state)).toBe("keep");
  expect(state.draw?.pool).toHaveLength(1);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [2] } : null));
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(totalCards(state)).toBe(before);
});

test("Reporter: a successful challenge makes the claimant lose a life and the coin fail", () => {
  let state = craftSet(commsSet("reporter"), [[ANN, ["banker", "banker"]]], "reporter-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "reporter", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(2);
});

test("Reporter: a failed challenge costs the challenger a life, then the coin and draw land", () => {
  let state = craftSet(commsSet("reporter"), [[ANN, ["reporter", "banker"]]], "reporter-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "reporter", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(openPurpose(state)).toBe("keep");
});
