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
  withHand,
  withPeacekeeping,
  withTreaty,
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
    hand: ["general", "banker"],
    lieHand: ["banker", "banker"],
    coins: 8,
    target: null,
    blockHand: ["general", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "block", "reveal", "block", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { bob: -1, cara: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "block", "reveal", "block", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { bob: -1, cara: -2 },
      },
      block: {
        purposes: ["challenge-claim", "block", "challenge-block", "block", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { cara: -1 },
      },
      blockLie: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "reveal", "block", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { bob: -2, cara: -1 },
      },
      blockTruth: {
        purposes: ["challenge-claim", "block", "challenge-block", "proof-block", "reveal", "block", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { cara: -2 },
      },
    },
  };

describeMatrix("general", record);

test("General: pay 5, every other player loses a life unless they block", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["general", "banker"]]], "general-hit"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, pass);
  // Two block windows open, one per target, clockwise from Ann.
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(0);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawHand(state, CARA)).toHaveLength(1);
});

test("General: a target who blocks with General keeps their life", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["general", "banker"]]], "general-block"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, pass);
  // Bob blocks; Cara does not.
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "general" } : null));
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawHand(state, CARA)).toHaveLength(1);
});

test("General: two blockers each open their own challenge-block window and resolve independently", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["general", "banker"]]], "general-two-block"),
    ANN,
    5,
  );
  state = withHand(state, BOB, ["general", "banker"]);
  state = withHand(state, CARA, ["banker", "banker"]);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "general" } : null));
  expect(openPurpose(state)).toBe("challenge-block");
  // Each block is a stacked extra claim, so the two windows resolve one at a time.
  expect(state.extras.at(-1)?.blocker).toBe(BOB);
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, (seat) => (seat === CARA ? { t: "block", role: "general" } : null));
  expect(openPurpose(state)).toBe("challenge-block");
  expect(state.extras.at(-1)?.blocker).toBe(CARA);
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === CARA ? { t: "concede" } : null));
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawHand(state, CARA)).toHaveLength(0);
});

test("General: a Peacekeeping holder is excluded and opens no block window", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["general", "banker"]]], "general-peace"),
    ANN,
    5,
  );
  state = withPeacekeeping(state, BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, pass);
  // The Peacekeeping holder is never a target, so only Cara owes a block.
  expect(openPurpose(state)).toBe("block");
  expect(seatsOwedAt(state)).toEqual([CARA]);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawHand(state, CARA)).toHaveLength(1);
});

test("General: a Treaty ally is excluded and opens no block window", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["general", "banker"]]], "general-ally"),
    ANN,
    5,
  );
  state = withTreaty(state, [ANN, BOB]);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, pass);
  // Only Cara is owed a block: Ann and Bob are allies, so Bob is not a target.
  expect(openPurpose(state)).toBe("block");
  expect(seatsOwedAt(state)).toEqual([CARA]);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawHand(state, CARA)).toHaveLength(1);
});

test("General: a successful challenge makes the claimant lose a life and the attack fail", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["banker", "banker"]]], "general-lie"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawHand(state, CARA)).toHaveLength(2);
});

test("General: a failed challenge costs the challenger a life, then the attack lands", () => {
  let state = withCoins(
    craftSet(forceSet("general"), [[ANN, ["general", "banker"]]], "general-true"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "general", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  // The attack still resolves: both remaining targets lose a life.
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
});
