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
  SEATS3,
  withCoins,
  withPeacekeeping,
} from "./driver.ts";
import type { RoleId } from "./driver.ts";

const pass = (): null => null;

const consularSet: readonly RoleId[] = [
  "banker",
  "director",
  "guerrilla",
  "foreign-consular",
  "politician",
];

test("Treaty: an ally cannot be targeted by a Coup either", () => {
  let state = withCoins(
    craftSet(consularSet, [[ANN, ["banker", "banker"]]], "treaty-coup"),
    ANN,
    8,
  );
  state = { ...state, treaty: [ANN, BOB] };
  // Ann's requested Coup on her ally Bob is illegal, so it lands on Cara instead.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
});

test("Treaty: the treaty expires when only two players remain", () => {
  let state = withCoins(
    craftSet(consularSet, [[ANN, ["banker", "banker"]]], "treaty-expire"),
    ANN,
    8,
  );
  state = { ...state, treaty: [ANN, BOB] };
  // Cara has one card; a Coup eliminates her, leaving Ann and Bob as the final two.
  state = withCoins(state, CARA, 0);
  state = {
    ...state,
    players: state.players.map((p) => (p.seat === CARA ? { ...p, hand: ["banker"] } : p)),
  };
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: CARA } : null));
  state = advance(state, pass);
  // Two players left: the treaty expires, so the ally shield is gone.
  expect(state.treaty).toEqual([]);
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

test("Tax: the mark applies to a role with no cost", () => {
  let state = craftSet(consularSet, [[BOB, ["director", "banker"]]], "tax-director");
  state = { ...state, tax: { role: "director", holder: ANN } };
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "director", target: null } : null,
  );
  expect(rawCoins(state, BOB)).toBe(1);
  expect(rawCoins(state, ANN)).toBe(4);
});

test("Tax: the holder is not taxed on their own claim", () => {
  let state = craftSet(consularSet, [[ANN, ["banker", "banker"]]], "tax-self");
  state = { ...state, tax: { role: "banker", holder: ANN } };
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  expect(rawCoins(state, ANN)).toBe(2);
});

test("Disappear: the token resolves after the target's next turn, not before", () => {
  let state = craftSet(
    ["banker", "director", "mercenary", "peacekeeper", "politician"],
    [[ANN, ["mercenary", "banker"]]],
    "disappear-timing",
    SEATS3,
  );
  state = withCoins(state, ANN, 3);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "mercenary", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  expect(state.disappear).toEqual([{ target: BOB, turns: 1 }]);
  // The turn passes to Bob; he still holds both cards during his turn.
  expect(state.active).toBe(BOB);
  expect(rawHand(state, BOB)).toHaveLength(2);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  // Now the token fires.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(state.disappear).toEqual([]);
});

test("Disappear: multiple tokens on one target stack their losses", () => {
  let state = craftSet(
    ["banker", "director", "mercenary", "peacekeeper", "politician"],
    [[ANN, ["mercenary", "banker"]]],
    "disappear-stack",
    SEATS3,
  );
  state = {
    ...state,
    disappear: [
      { target: BOB, turns: 1 },
      { target: BOB, turns: 1 },
    ],
  };
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  // Two stacked tokens queue two reveals.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
});

test("Disappear: the token is discarded if the target is eliminated first", () => {
  let state = craftSet(
    ["banker", "director", "guerrilla", "peacekeeper", "politician"],
    [[ANN, ["guerrilla", "banker"]]],
    "disappear-dead",
    SEATS3,
  );
  state = withCoins(state, ANN, 4);
  state = {
    ...state,
    disappear: [{ target: BOB, turns: 1 }],
    players: state.players.map((p) => (p.seat === BOB ? { ...p, hand: ["banker"] } : p)),
  };
  // Ann eliminates Bob before the token resolves.
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(state.disappear).toEqual([]);
});
