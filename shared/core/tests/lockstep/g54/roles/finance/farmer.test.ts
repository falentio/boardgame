import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  advance,
  craftSet,
  rawCoins,
  rawHand,
  type RoleId,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";

/** A three-seat set whose Finance role is the one under test. */
const financeSet = (finance: RoleId): readonly RoleId[] => [
  finance,
  "director",
  "guerrilla",
  "peacekeeper",
  "politician",
];

const record: RoleRecord = {
    hand: ["farmer", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: BOB,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 2, bob: 1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 2, bob: 1 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("farmer", record);

test("Farmer: take 3, keep 2, give 1 to the chosen player", () => {
  let state = craftSet(financeSet("farmer"), [[ANN, ["farmer", "banker"]]], "farmer-action");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "farmer", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawCoins(state, BOB)).toBe(3);
});

test("Farmer: a successful challenge makes the claimant lose a life and the gift fail", () => {
  let state = craftSet(financeSet("farmer"), [[ANN, ["banker", "banker"]]], "farmer-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "farmer", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(rawCoins(state, BOB)).toBe(2);
});

test("Farmer: a failed challenge costs the challenger a life, then the gift lands", () => {
  let state = craftSet(financeSet("farmer"), [[ANN, ["farmer", "banker"]]], "farmer-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "farmer", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawCoins(state, BOB)).toBe(3);
});

test("Farmer: a short Treasury clamps the take while the gift still lands", () => {
  let state = craftSet(financeSet("farmer"), [[ANN, ["farmer", "banker"]]], "farmer-short");
  state = { ...state, treasury: 2 };
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "farmer", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(3);
  expect(state.treasury).toBe(0);
});
