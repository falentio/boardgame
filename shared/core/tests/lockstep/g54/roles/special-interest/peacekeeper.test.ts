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
  withCoins,
  withHands,
  withPeacekeeping,
  type RoleId,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";
import {
  seatId,
} from "../../../../../index.ts";

/** A three-seat set with two Special Interest roles: the tested one and Politician. */
const specialSet = (special: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  "guerrilla",
  special,
  "politician",
];

const consularSet: readonly RoleId[] = [
  "banker",
  "director",
  "guerrilla",
  "foreign-consular",
  "politician",
];

const record: RoleRecord = {
    hand: ["peacekeeper", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: null,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "turn"],
        coins: { ann: 1 },
        peacekeeping: seatId("ann"),
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: 1 },
        hands: { cara: -1 },
        peacekeeping: seatId("ann"),
      },
    },
  };

describeMatrix("peacekeeper", record);

test("Peacekeeper: take 1 coin and the Peacekeeping token", () => {
  let state = withHands([[ANN, ["peacekeeper", "banker"]]], "peacekeeper-action");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "peacekeeper", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(state.peacekeeping).toBe(ANN);
});

test("Peacekeeper: a new claim steals the token from the prior holder", () => {
  let state = withHands([[BOB, ["peacekeeper", "banker"]]], "peacekeeper-steal");
  state = { ...state, peacekeeping: ANN };
  // Ann's turn first: income, then Bob claims Peacekeeper and takes the token.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "peacekeeper", target: null } : null,
  );
  state = advance(state, pass);
  expect(state.peacekeeping).toBe(BOB);
});

test("Peacekeeper: a failed challenge costs the challenger a life, then the token moves", () => {
  let state = withHands([[ANN, ["peacekeeper", "banker"]]], "peacekeeper-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "peacekeeper", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(state.peacekeeping).toBe(ANN);
  expect(rawCoins(state, ANN)).toBe(3);
});

test("Peacekeeper: a successful challenge costs the claimant a life and the token does not move", () => {
  let state = withHands([[ANN, ["banker", "banker"]]], "peacekeeper-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "peacekeeper", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(state.peacekeeping).toBeNull();
  expect(rawCoins(state, ANN)).toBe(2);
});

test("Peacekeeping: a former holder is targetable once the token is stolen", () => {
  let state = craftSet(
    specialSet("peacekeeper"),
    [
      [ANN, ["banker", "banker"]],
      [BOB, ["peacekeeper", "banker"]],
      [CARA, ["politician", "banker"]],
    ],
    "peace-former",
  );
  state = withPeacekeeping(state, ANN);
  // Ann's income hands the turn to Bob, who steals the token from her.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "peacekeeper", target: null } : null,
  );
  state = advance(state, pass);
  expect(state.peacekeeping).toBe(BOB);
  expect(state.active).toBe(CARA);
  // Ann no longer holds the token, so Cara's Politician claim on her is legal.
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: ANN } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Ann was robbed of 2 (3 after her income); had she still held the token the
  // claim would have coerced to Income instead.
  expect(rawCoins(state, ANN)).toBe(1);
  expect(rawCoins(state, CARA)).toBe(4);
});

test("Peacekeeping: a Politician cannot steal from the holder", () => {
  let state = withPeacekeeping(
    craftSet(specialSet("peacekeeper"), [[ANN, ["politician", "banker"]]], "peace-politician"),
    BOB,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: BOB } : null,
  );
  // The shielded target coerces the claim to Income.
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(2);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Peacekeeping: the holder is skipped as the Communist victim", () => {
  let state = withPeacekeeping(
    craftSet(specialSet("communist"), [[ANN, ["communist", "banker"]]], "peace-communist"),
    BOB,
  );
  state = withCoins(state, ANN, 0);
  state = withCoins(state, BOB, 8);
  state = withCoins(state, CARA, 5);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Bob would be the wealthiest, but the token skips him: Cara is robbed instead.
  expect(rawCoins(state, BOB)).toBe(8);
  expect(rawCoins(state, CARA)).toBe(2);
  expect(rawCoins(state, ANN)).toBe(3);
});

test("Peacekeeping: a Protestor cannot target the holder", () => {
  let state = withPeacekeeping(
    withCoins(
      craftSet(specialSet("protestor"), [[ANN, ["protestor", "banker"]]], "peace-protestor"),
      ANN,
      5,
    ),
    BOB,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "protestor", target: BOB } : null,
  );
  // The shielded target coerces the claim to Income.
  expect(rawCoins(state, ANN)).toBe(6);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Peacekeeping: the holder cannot be targeted except by Coup", () => {
  let state = withPeacekeeping(
    withCoins(craftSet(consularSet, [[ANN, ["guerrilla", "banker"]]], "peace-role"), ANN, 4),
    BOB,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  // The shielded target coerces to Income.
  expect(rawCoins(state, ANN)).toBe(5);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Peacekeeping: the holder can still be targeted by a Coup", () => {
  let state = withPeacekeeping(
    withCoins(craftSet(consularSet, [[ANN, ["banker", "banker"]]], "peace-coup2"), ANN, 8),
    BOB,
  );
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Peacekeeping: a new claim steals the token from the prior holder", () => {
  let state = craftSet(
    ["banker", "director", "guerrilla", "peacekeeper", "politician"],
    [[BOB, ["peacekeeper", "banker"]]],
    "peace-steal",
  );
  state = { ...state, peacekeeping: ANN };
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "peacekeeper", target: null } : null,
  );
  state = advance(state, pass);
  expect(state.peacekeeping).toBe(BOB);
});
