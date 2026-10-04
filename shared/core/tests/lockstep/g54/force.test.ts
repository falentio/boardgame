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
} from "./driver.ts";
import type { RoleId } from "./driver.ts";

/** A three-seat set whose Force role is the one under test. */
const forceSet = (force: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  force,
  "peacekeeper",
  "politician",
];

const pass = (): null => null;

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

test("Mercenary: place a Disappear token that resolves after the target's next turn", () => {
  let state = withCoins(
    craftSet(forceSet("mercenary"), [[ANN, ["mercenary", "banker"]]], "merc-place"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(state.disappear).toHaveLength(1);
  expect(state.disappear[0]?.target).toBe(BOB);
  // The claim ended Ann's turn; Bob takes his full turn and the token fires at its end.
  expect(state.active).toBe(BOB);
  expect(rawHand(state, BOB)).toHaveLength(2);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  // The reveal window for the token loss opens before Cara's turn.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(state.disappear).toHaveLength(0);
  expect(state.active).toBe(CARA);
});

test("Mercenary: the target blocks at placement and no token is placed", () => {
  let state = withCoins(
    craftSet(forceSet("mercenary"), [[BOB, ["mercenary", "banker"]]], "merc-block"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "mercenary" } : null));
  state = advance(state, pass);
  expect(state.disappear).toHaveLength(0);
  expect(rawCoins(state, ANN)).toBe(0);
});

test("Mercenary: a successful challenge costs a life and no token is placed", () => {
  let state = withCoins(
    craftSet(forceSet("mercenary"), [[ANN, ["banker", "banker"]]], "merc-lie"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(state.disappear).toHaveLength(0);
});

test("Mercenary: a failed challenge costs the challenger a life, then the token lands", () => {
  let state = withCoins(
    craftSet(forceSet("mercenary"), [[ANN, ["mercenary", "banker"]]], "merc-true"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  state = advance(state, pass);
  expect(state.disappear).toHaveLength(1);
});
