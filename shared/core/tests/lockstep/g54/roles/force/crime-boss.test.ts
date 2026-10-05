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
    hand: ["crime-boss", "banker"],
    lieHand: ["banker", "banker"],
    coins: 8,
    target: BOB,
    blockHand: ["banker", "banker", "banker"],
    expect: {
      resolve: {
        purposes: ["challenge-claim", "crime-pay", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { bob: -1 },
      },
      lie: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "turn"],
        hands: { ann: -1 },
      },
      truth: {
        purposes: ["challenge-claim", "proof-claim", "reveal", "crime-pay", "reveal", "turn"],
        coins: { ann: -5 },
        hands: { bob: -1, cara: -1 },
      },
    },
  };

describeMatrix("crime-boss", record);

test("Crime Boss: the target pays 2 to the claimant to end the action", () => {
  let state = withCoins(
    craftSet(forceSet("crime-boss"), [[ANN, ["crime-boss", "banker"]]], "cb-pay"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "crime-boss", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("crime-pay");
  state = advance(state, (seat) => (seat === BOB ? { t: "pay" } : null));
  // Ann paid nothing to claim Crime Boss, so the target's 2 coins land on top.
  expect(rawCoins(state, ANN)).toBe(7);
  expect(rawCoins(state, BOB)).toBe(0);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(openPurpose(state)).toBe("turn");
});

test("Crime Boss: refusal costs the claimant 5 and the target a life", () => {
  let state = withCoins(
    craftSet(forceSet("crime-boss"), [[ANN, ["crime-boss", "banker"]]], "cb-refuse"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "crime-boss", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "no" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(0);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Crime Boss: a target holding under 2 coins cannot pay, so the report is a refusal", () => {
  let state = withCoins(
    craftSet(forceSet("crime-boss"), [[ANN, ["crime-boss", "banker"]]], "cb-short"),
    ANN,
    5,
  );
  state = withCoins(state, BOB, 1);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "crime-boss", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("crime-pay");
  // Bob holds only 1 coin, so his `pay` cannot cover 2 and is read as a refusal.
  state = advance(state, (seat) => (seat === BOB ? { t: "pay" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawCoins(state, BOB)).toBe(1);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(0);
});

test("Crime Boss: only the target may decide the pay window", () => {
  let state = withCoins(
    craftSet(forceSet("crime-boss"), [[ANN, ["crime-boss", "banker"]]], "cb-only"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "crime-boss", target: BOB } : null,
  );
  state = advance(state, pass);
  // Cara is not owed; her `pay` is ignored and the target's silence is a refusal.
  state = advance(state, (seat) => (seat === CARA ? { t: "pay" } : null));
  expect(rawCoins(state, ANN)).toBe(0);
  expect(rawCoins(state, BOB)).toBe(2);
});

test("Crime Boss: a successful challenge makes the claimant lose a life and the kill fail", () => {
  let state = withCoins(
    craftSet(forceSet("crime-boss"), [[ANN, ["banker", "banker"]]], "cb-lie"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "crime-boss", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Crime Boss: a failed challenge costs the challenger a life, then the pay window opens", () => {
  let state = withCoins(
    craftSet(forceSet("crime-boss"), [[ANN, ["crime-boss", "banker"]]], "cb-true"),
    ANN,
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "crime-boss", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("crime-pay");
});
