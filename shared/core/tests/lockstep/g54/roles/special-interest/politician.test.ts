import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  advance,
  openPurpose,
  rawCoins,
  rawHand,
  withCoins,
  withHands,
} from "../../driver.ts";
import {
  describeMatrix,
  pass,
  type RoleRecord,
} from "../matrix-driver.ts";

const record: RoleRecord = {
    hand: ["politician", "banker"],
    lieHand: ["banker", "banker"],
    coins: 3,
    target: BOB,
    blockHand: ["politician", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "turn"],
        coins: { ann: 2, bob: -2 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "turn"],
        coins: { ann: 2, bob: -2 },
        hands: { cara: -1 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "turn"],
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        coins: { ann: 2, bob: -2 },
        hands: { bob: -1 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "turn"],
        hands: { cara: -1 },
      },
    },
  };

describeMatrix("politician", record);

test("Politician: steal up to 2 coins from a target", () => {
  let state = withCoins(withHands([[ANN, ["politician", "banker"]]], "politician-action"), BOB, 5);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawCoins(state, BOB)).toBe(3);
});

test("Politician: the target blocks with Politician and the theft is stopped", () => {
  let state = withCoins(withHands([[BOB, ["politician", "banker"]]], "politician-block"), BOB, 5);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "politician" } : null));
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(rawCoins(state, BOB)).toBe(5);
});

test("Politician: a successful challenge makes the claimant lose a life and the theft fail", () => {
  let state = withCoins(withHands([[ANN, ["banker", "banker"]]], "politician-lie"), BOB, 5);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(5);
});

test("Politician: a failed challenge costs the challenger a life, then the steal resolves", () => {
  let state = withCoins(withHands([[ANN, ["politician", "banker"]]], "politician-true"), BOB, 5);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  // Bob is the target and does not block, so the steal lands.
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawCoins(state, BOB)).toBe(3);
});
