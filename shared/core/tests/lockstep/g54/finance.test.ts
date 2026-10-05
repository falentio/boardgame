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
  withBank,
  withCoins,
} from "./driver.ts";
import type { RoleId } from "./driver.ts";

/** A three-seat set whose Finance role is the one under test. */
const financeSet = (finance: RoleId): readonly RoleId[] => [
  finance,
  "director",
  "guerrilla",
  "peacekeeper",
  "politician",
];

const pass = (): null => null;

test("Capitalist: take 4, then each rival may claim Capitalist to take 1", () => {
  let state = craftSet(financeSet("capitalist"), [[ANN, ["capitalist", "banker"]]], "cap-action");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("capitalist");
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "capitalist", target: null } : null,
  );
  // Bob's collection opens its own challenge window.
  expect(openPurpose(state)).toBe("challenge-claim");
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(5);
  expect(rawCoins(state, BOB)).toBe(3);
  // The turn ended exactly once: it is now Bob's turn.
  expect(state.active).toBe(BOB);
});

test("Capitalist: a secondary collection can be challenged", () => {
  let state = craftSet(
    financeSet("capitalist"),
    [[ANN, ["capitalist", "banker"]]],
    "cap-challenge",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "capitalist", target: null } : null,
  );
  // Cara challenges Bob's secondary claim; Bob concedes.
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(6);
  expect(rawCoins(state, BOB)).toBe(2);
});

test("Capitalist: a successful challenge makes the claimant lose a life and the whole action fail", () => {
  let state = craftSet(financeSet("capitalist"), [[ANN, ["banker", "banker"]]], "cap-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(2);
});

test("Capitalist: a failed challenge costs the challenger a life, then the collection resolves", () => {
  let state = craftSet(financeSet("capitalist"), [[ANN, ["capitalist", "banker"]]], "cap-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("capitalist");
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(6);
});

test("Capitalist: two rivals' secondary claims resolve clockwise from the active seat", () => {
  let state = craftSet(financeSet("capitalist"), [[ANN, ["capitalist", "banker"]]], "cap-multi");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("capitalist");
  state = advance(state, (seat) =>
    seat === BOB || seat === CARA ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, BOB)).toBe(3);
  expect(rawCoins(state, CARA)).toBe(2);
  expect(openPurpose(state)).toBe("challenge-claim");
  state = advance(state, pass);
  expect(rawCoins(state, CARA)).toBe(3);
  expect(rawCoins(state, ANN)).toBe(4);
});

test("Capitalist: an active purse short of the claimants clamps the secondary transfer", () => {
  let state = withCoins(
    craftSet(financeSet("capitalist"), [[ANN, ["capitalist", "banker"]]], "cap-short"),
    ANN,
    0,
  );
  state = { ...state, treasury: 1 };
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(1);
  state = advance(state, (seat) =>
    seat === BOB || seat === CARA ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(0);
  expect(rawCoins(state, BOB)).toBe(3);
  expect(rawCoins(state, CARA)).toBe(2);
  expect(state.treasury).toBe(0);
});

test("Farmer: take 3, keep 2, give 1 to the chosen player", () => {
  let state = craftSet(financeSet("farmer"), [[ANN, ["farmer", "banker"]]], "farmer-action");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "farmer", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawCoins(state, BOB)).toBe(3);
});

test("Farmer: a successful challenge makes the claimant lose a life and the gift fail", () => {
  let state = craftSet(financeSet("farmer"), [[ANN, ["banker", "banker"]]], "farmer-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "farmer", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(rawCoins(state, BOB)).toBe(2);
});

test("Farmer: a failed challenge costs the challenger a life, then the gift lands", () => {
  let state = craftSet(financeSet("farmer"), [[ANN, ["farmer", "banker"]]], "farmer-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "farmer", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawCoins(state, BOB)).toBe(3);
});

test("Farmer: a short Treasury clamps the take while the gift still lands", () => {
  let state = craftSet(financeSet("farmer"), [[ANN, ["farmer", "banker"]]], "farmer-short");
  state = { ...state, treasury: 2 };
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "farmer", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(3);
  expect(state.treasury).toBe(0);
});

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

test("Spy: take 1, then immediately take a second action", () => {
  let state = craftSet(financeSet("spy"), [[ANN, ["spy", "banker"]]], "spy-action");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(openPurpose(state)).toBe("spy-second");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(rawCoins(state, ANN)).toBe(4);
  expect(state.active).toBe(BOB);
});

test("Spy: the second action is a full claim with its own challenge window", () => {
  let state = withCoins(
    craftSet(financeSet("spy"), [[ANN, ["spy", "guerrilla"]]], "spy-second-claim"),
    ANN,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("spy-second");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  expect(openPurpose(state)).toBe("challenge-claim");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Spy: a successful challenge makes the claimant lose a life and the spy action fail", () => {
  let state = craftSet(financeSet("spy"), [[ANN, ["banker", "banker"]]], "spy-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(state.active).toBe(BOB);
});

test("Spy: a failed challenge costs the challenger a life, then the second action opens", () => {
  let state = craftSet(financeSet("spy"), [[ANN, ["spy", "banker"]]], "spy-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("spy-second");
});

test("Spy: at 10+ coins the second action must be Coup", () => {
  let state = withCoins(
    craftSet(financeSet("spy"), [[ANN, ["spy", "banker"]]], "spy-forced"),
    ANN,
    9,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(10);
  expect(openPurpose(state)).toBe("spy-second");
  // An Income report is coerced to Coup at 10 coins.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(rawCoins(state, ANN)).toBe(3);
});

test("Financier: the claim sweeps the whole Bank pile", () => {
  let state = withBank(
    withCoins(
      craftSet(financeSet("financier"), [[ANN, ["financier", "banker"]]], "fin-sweep"),
      ANN,
      2,
    ),
    6,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "financier", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(8);
  expect(state.bank).toBe(0);
});

test("Financier: Bank replaces Income and grows the pile without touching the purse", () => {
  let state = withCoins(
    craftSet(financeSet("financier"), [[ANN, ["financier", "banker"]]], "fin-bank"),
    ANN,
    2,
  );
  state = advance(state, (seat, s) => (seat === s.active ? { t: "bank" } : null));
  expect(rawCoins(state, ANN)).toBe(2);
  expect(state.bank).toBe(1);
  expect(state.active).toBe(BOB);
  // An Income report is not a legal general action while Financier is in play: it
  // coerces to the fallback (Bank), still moving a coin into the pile.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(rawCoins(state, BOB)).toBe(2);
  expect(state.bank).toBe(2);
});

test("Financier: a successful challenge costs a life and the pile is not swept", () => {
  let state = withBank(
    craftSet(financeSet("financier"), [[ANN, ["banker", "banker"]]], "fin-lie"),
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "financier", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(state.bank).toBe(5);
});

test("Plantation Owner: take 1, then each survivor gains 1 per survivor", () => {
  let state = craftSet(
    financeSet("plantation-owner"),
    [[ANN, ["plantation-owner", "banker"]]],
    "plant-payout",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("capitalist");
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("plantation-payout");
  state = advance(state, pass);
  // Payout is 2 per survivor; Ann took 1 first, so Ann ends at 2 + 1 + 2 = 5, Bob at 2 + 2 = 4.
  expect(rawCoins(state, ANN)).toBe(5);
  expect(rawCoins(state, BOB)).toBe(4);
});

test("Plantation Owner: a failed claimant is excluded from the payout", () => {
  let state = craftSet(
    financeSet("plantation-owner"),
    [[ANN, ["plantation-owner", "banker"]]],
    "plant-fail",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("plantation-payout");
  state = advance(state, pass);
  // Only Ann survives, so the payout is 1: Ann ends at 2 + 1 + 1 = 4, Bob stays at 2.
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawCoins(state, BOB)).toBe(2);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Plantation Owner: a short Treasury pays a partial payout", () => {
  let state = craftSet(
    financeSet("plantation-owner"),
    [[ANN, ["plantation-owner", "banker"]]],
    "plant-short",
  );
  // Treasury of 3: the take-1 leaves 2, then the 2-coin payout runs short.
  state = { ...state, treasury: 3 };
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "plantation-owner", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Two survivors each owed 2, but only 2 coins remain: Ann is paid, Bob is not.
  expect(rawCoins(state, ANN)).toBe(5);
  expect(rawCoins(state, BOB)).toBe(2);
  expect(state.treasury).toBe(0);
});
