import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  advance,
  craftSet,
  openPurpose,
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
    hand: ["judge", "banker"],
    lieHand: ["banker", "banker"],
    coins: 6,
    target: BOB,
    blockHand: ["judge", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "reveal", "turn"],
        coins: { ann: -3, bob: 3 },
        hands: { bob: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        coins: { ann: -3, bob: 3 },
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "reveal", "turn"],
        coins: { ann: -3, bob: 3 },
        hands: { bob: -1, cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
        coins: { ann: -3, bob: 3 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "reveal", "turn"],
        coins: { ann: -3, bob: 3 },
        hands: { bob: -2 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: -3, bob: 3 },
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("judge", record);

test("Judge: give 3 to the target, who loses a life unless blocked", () => {
  let state = withCoins(
    craftSet(forceSet("judge"), [[ANN, ["judge", "banker"]]], "judge-hit"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "judge", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(rawCoins(state, BOB)).toBe(5);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Judge: a block stops the kill and the target keeps the 3 coins", () => {
  let state = withCoins(
    craftSet(forceSet("judge"), [[BOB, ["judge", "banker"]]], "judge-block"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "judge", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "judge" } : null));
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(rawCoins(state, BOB)).toBe(5);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Judge: a successful challenge costs the claimant a life but the target keeps the 3", () => {
  let state = withCoins(
    craftSet(forceSet("judge"), [[ANN, ["banker", "banker"]]], "judge-lie"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "judge", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(5);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Judge: a failed challenge costs the challenger a life, then the kill lands", () => {
  let state = withCoins(
    craftSet(forceSet("judge"), [[ANN, ["judge", "banker"]]], "judge-true"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "judge", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
});
