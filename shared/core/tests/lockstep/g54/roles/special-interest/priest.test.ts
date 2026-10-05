import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  rawHand,
  seatsOwedAt,
  withCoins,
  withPeacekeeping,
  withTreaty,
  type RoleId,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";

/** A three-seat set with two Special Interest roles: the tested one and Politician. */
const specialSet = (special: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  "guerrilla",
  special,
  "politician",
];

const record: RoleRecord = {
    hand: ["priest", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["priest", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "block", "turn"],
        coins: { ann: 2, bob: -1, cara: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "block", "turn"],
        coins: { ann: 2, bob: -1, cara: -1 },
        hands: { cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "block", "turn"],
        coins: { ann: 1, cara: -1 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "block", "turn"],
        coins: { ann: 2, bob: -1, cara: -1 },
        hands: { bob: -1 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "block", "turn"],
        coins: { ann: 1, cara: -1 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("priest", record);

test("Priest: all other players give 1 coin if able", () => {
  let state = craftSet(specialSet("priest"), [[ANN, ["priest", "banker"]]], "priest-action");
  state = withCoins(state, CARA, 0);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "priest", target: null } : null,
  );
  state = advance(state, pass);
  // Two per-payer block windows open, clockwise from Ann.
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  state = advance(state, pass);
  // Bob paid 1; Cara had 0 and paid 0.
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(1);
  expect(rawCoins(state, CARA)).toBe(0);
  expect(openPurpose(state)).toBe("turn");
});

test("Priest: a payer blocks their own payment only", () => {
  let state = craftSet(specialSet("priest"), [[BOB, ["priest", "banker"]]], "priest-block");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "priest", target: null } : null,
  );
  state = advance(state, pass);
  // Bob blocks his own payment; Cara does not.
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "priest" } : null));
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(2);
  expect(rawCoins(state, CARA)).toBe(1);
});

test("Priest: a successful challenge costs a life and the collection fails", () => {
  let state = craftSet(specialSet("priest"), [[ANN, ["banker", "banker"]]], "priest-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "priest", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(2);
});

test("Priest: a failed challenge costs the challenger a life, then the collection lands", () => {
  let state = craftSet(specialSet("priest"), [[ANN, ["priest", "banker"]]], "priest-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "priest", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(4);
});

test("Priest: a Peacekeeping holder pays nothing and is owed no window", () => {
  let state = withPeacekeeping(
    craftSet(specialSet("priest"), [[ANN, ["priest", "banker"]]], "priest-peace"),
    BOB,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "priest", target: null } : null,
  );
  state = advance(state, pass);
  // Only Cara is owed a payment window; the Peacekeeping holder Bob is skipped.
  expect(seatsOwedAt(state)).toEqual([CARA]);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(2);
  expect(rawCoins(state, CARA)).toBe(1);
  expect(openPurpose(state)).toBe("turn");
});

test("Priest: a treaty ally is still reached", () => {
  let state = withTreaty(
    craftSet(specialSet("priest"), [[ANN, ["priest", "banker"]]], "priest-ally"),
    [ANN, BOB],
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "priest", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  // The ally Bob pays his coin like any other seat.
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawCoins(state, BOB)).toBe(1);
});
