import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  DAN,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  rawHand,
  seatsOwedAt,
  withCoins,
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
    hand: ["protestor", "banker"],
    lieHand: ["banker", "banker"],
    coins: 5,
    blockFunder: "cara",
    blockCaraCoins: 3,
    target: BOB,
    blockHand: ["protestor", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "protestor-fund", "turn"],
        coins: { ann: -2 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "protestor-fund", "turn"],
        coins: { ann: -2 },
        hands: { cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "protestor-fund", "block", "challenge-block", "turn"],
        coins: { ann: -2, cara: -3 },
      },
      blockLie: {
        purposes: ["challenge-claim", "protestor-fund", "block", "challenge-block", "proof-block", "reveal", "reveal", "turn"],
        coins: { ann: -2, cara: -3 },
        hands: { bob: -2 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "protestor-fund", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: -2, cara: -3 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("protestor", record);

test("Protestor: pay 2, then any other player may pay 3 to force the kill", () => {
  let state = withCoins(
    craftSet(specialSet("protestor"), [[ANN, ["protestor", "banker"]]], "protestor-action"),
    ANN,
    5,
  );
  state = withCoins(state, CARA, 3);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "protestor", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("protestor-fund");
  state = advance(state, (seat) => (seat === CARA ? { t: "pay" } : null));
  expect(rawCoins(state, CARA)).toBe(0);
  // The target may block after the funding.
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Protestor: with no funder the target is safe", () => {
  let state = withCoins(
    craftSet(specialSet("protestor"), [[ANN, ["protestor", "banker"]]], "protestor-nofund"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "protestor", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Protestor: the target is excluded from the funding window", () => {
  let state = withCoins(
    craftSet(specialSet("protestor"), [[ANN, ["protestor", "banker"]]], "protestor-owed"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "protestor", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("protestor-fund");
  // Every live seat but the target is owed; the target Bob is not.
  expect(seatsOwedAt(state)).toEqual([ANN, CARA]);
});

test("Protestor: two funders resolve to the clockwise-first only", () => {
  let state = withCoins(
    craftSet(
      specialSet("protestor"),
      [[ANN, ["protestor", "banker"]]],
      "protestor-funders",
      [ANN, BOB, CARA, DAN],
    ),
    ANN,
    5,
  );
  state = withCoins(state, CARA, 3);
  state = withCoins(state, DAN, 3);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "protestor", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("protestor-fund");
  state = advance(state, (seat) => (seat === CARA || seat === DAN ? { t: "pay" } : null));
  // Cara is clockwise-first from Ann, so only she is charged; Dan is untouched.
  expect(rawCoins(state, CARA)).toBe(0);
  expect(rawCoins(state, DAN)).toBe(3);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  // The kill lands exactly once.
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Protestor: the target blocks after the money is paid and the coins stay paid", () => {
  let state = withCoins(
    craftSet(specialSet("protestor"), [[ANN, ["protestor", "banker"]]], "protestor-block"),
    ANN,
    5,
  );
  state = withCoins(state, CARA, 3);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "protestor", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === CARA ? { t: "pay" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "protestor" } : null));
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawCoins(state, CARA)).toBe(0);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Protestor: a successful challenge costs a life and the kill fails", () => {
  let state = withCoins(
    craftSet(specialSet("protestor"), [[ANN, ["banker", "banker"]]], "protestor-lie"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "protestor", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(5);
});

test("Protestor: a failed challenge costs the challenger a life, then funding opens", () => {
  let state = withCoins(
    craftSet(specialSet("protestor"), [[ANN, ["protestor", "banker"]]], "protestor-true"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "protestor", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("protestor-fund");
});
