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

/** A three-seat set whose Force role is the one under test. */
const forceSet = (force: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  force,
  "peacekeeper",
  "politician",
];

const record: RoleRecord = {
    hand: ["paramilitary", "banker"],
    lieHand: ["banker", "banker"],
    coins: 5,
    target: BOB,
    blockHand: ["paramilitary", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { bob: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { bob: -1, cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
        coins: { ann: -3 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { bob: -2 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: -3 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("paramilitary", record);

test("Paramilitary: a 2-life target costs 3, a 1-life target costs 5", () => {
  let full = withCoins(
    craftSet(forceSet("paramilitary"), [[ANN, ["paramilitary", "banker"]]], "para-2life"),
    ANN,
    5,
  );
  full = advance(full, (seat, s) =>
    seat === s.active ? { t: "claim", role: "paramilitary", target: BOB } : null,
  );
  full = advance(full, pass);
  full = advance(full, pass);
  full = advance(full, pass);
  expect(rawCoins(full, ANN)).toBe(2);
  expect(rawHand(full, BOB)).toHaveLength(1);

  let thin = withCoins(
    craftSet(
      forceSet("paramilitary"),
      [[ANN, ["paramilitary", "banker"]]],
      "para-1life",
    ),
    ANN,
    5,
  );
  thin = {
    ...thin,
    players: thin.players.map((p) => (p.seat === BOB ? { ...p, hand: ["banker"] } : p)),
  };
  thin = advance(thin, (seat, s) =>
    seat === s.active ? { t: "claim", role: "paramilitary", target: BOB } : null,
  );
  thin = advance(thin, pass);
  thin = advance(thin, pass);
  thin = advance(thin, pass);
  expect(rawCoins(thin, ANN)).toBe(0);
  expect(rawHand(thin, BOB)).toHaveLength(0);
});

test("Paramilitary: an unaffordable 1-life hit coerces to the fallback general action", () => {
  let state = withCoins(
    craftSet(forceSet("paramilitary"), [[ANN, ["paramilitary", "banker"]]], "para-short"),
    ANN,
    3,
  );
  state = {
    ...state,
    players: state.players.map((p) => (p.seat === BOB ? { ...p, hand: ["banker"] } : p)),
  };
  // 5 coins are needed for a 1-life target; Ann has 3, so the claim falls back to Income.
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "paramilitary", target: BOB } : null,
  );
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Paramilitary: a block refunds nothing and spares the target", () => {
  let state = withCoins(
    craftSet(forceSet("paramilitary"), [[BOB, ["paramilitary", "banker"]]], "para-block"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "paramilitary", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "paramilitary" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawCoins(state, ANN)).toBe(2);
});
