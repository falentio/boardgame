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
