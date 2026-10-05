import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  advance,
  craftSet,
  rawCoins,
  rawHand,
  withCoins,
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
    hand: ["speculator", "banker"],
    lieHand: ["banker", "banker"],
    coins: 6,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 5 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: -6, cara: 6 },
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 5 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("speculator", record);

test("Speculator: a claimant holding no coins takes nothing", () => {
  let state = withCoins(
    craftSet(financeSet("speculator"), [[ANN, ["speculator", "banker"]]], "spec-zero"),
    ANN,
    0,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "speculator", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(0);
  expect(state.active).toBe(BOB);
});

test("Speculator: double your coins from the Treasury, capped at 5 taken", () => {
  let state = withCoins(
    craftSet(financeSet("speculator"), [[ANN, ["speculator", "banker"]]], "spec-action"),
    ANN,
    6,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "speculator", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(11);
});

test("Speculator: a successful challenge hands the challenger all the claimant's coins", () => {
  let state = withCoins(
    craftSet(financeSet("speculator"), [[ANN, ["banker", "banker"]]], "spec-lie"),
    ANN,
    6,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "speculator", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(0);
  expect(rawCoins(state, BOB)).toBe(8);
});

test("Speculator: a failed challenge costs the challenger a life, then the doubling lands", () => {
  let state = withCoins(
    craftSet(financeSet("speculator"), [[ANN, ["speculator", "banker"]]], "spec-true"),
    ANN,
    6,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "speculator", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(11);
});
