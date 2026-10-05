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
  totalCards,
  totalCoins,
  withCoins,
  withCourt,
  withPeacekeeping,
  withTax,
  withTreaty,
} from "./driver.ts";
import type { RoleId } from "./driver.ts";

/** A three-seat set with two Special Interest roles: the tested one and Politician. */
const specialSet = (special: RoleId): readonly RoleId[] => [
  "banker",
  "director",
  "guerrilla",
  special,
  "politician",
];

const pass = (): null => null;

test("Communist: steal up to 3 from the wealthiest and give them to the poorest", () => {
  let state = withCoins(
    craftSet(specialSet("communist"), [[ANN, ["communist", "banker"]]], "comm-action"),
    BOB,
    8,
  );
  state = withCoins(state, CARA, 1);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  // Bob was wealthiest (8), Cara poorest (1): 3 moves from Bob to Cara.
  expect(rawCoins(state, BOB)).toBe(5);
  expect(rawCoins(state, CARA)).toBe(4);
  expect(rawCoins(state, ANN)).toBe(2);
});

test("Communist: the wealthiest target blocks and the theft is stopped", () => {
  let state = withCoins(
    craftSet(specialSet("communist"), [[BOB, ["communist", "banker"]]], "comm-block"),
    BOB,
    8,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "communist" } : null));
  state = advance(state, pass);
  expect(rawCoins(state, BOB)).toBe(8);
});

test("Communist: a successful challenge costs a life and the theft fails", () => {
  let state = withCoins(
    craftSet(specialSet("communist"), [[ANN, ["banker", "banker"]]], "comm-lie"),
    BOB,
    8,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(8);
});

test("Communist: a failed challenge costs the challenger a life, then the theft lands", () => {
  let state = withCoins(
    craftSet(specialSet("communist"), [[ANN, ["communist", "banker"]]], "comm-true"),
    BOB,
    8,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  state = advance(state, pass);
  expect(rawCoins(state, BOB)).toBe(5);
});

test("Communist: a victim holding fewer than 3 coins is robbed partially", () => {
  let state = craftSet(specialSet("communist"), [[ANN, ["communist", "banker"]]], "comm-partial");
  state = withCoins(state, BOB, 2);
  state = withCoins(state, CARA, 0);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  // Bob held only 2, so the 3-coin theft is capped and Cara gains exactly 2.
  expect(rawCoins(state, BOB)).toBe(0);
  expect(rawCoins(state, CARA)).toBe(2);
  expect(rawCoins(state, ANN)).toBe(2);
});

test("Communist: a poorest tie resolves clockwise from the actor", () => {
  let state = craftSet(
    specialSet("communist"),
    [[ANN, ["communist", "banker"]]],
    "comm-poorest-tie",
    [ANN, BOB, CARA, DAN],
  );
  state = withCoins(state, BOB, 0);
  state = withCoins(state, CARA, 5);
  state = withCoins(state, DAN, 0);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Bob and Dan tie at 0; Bob is clockwise-first from Ann, so Bob receives.
  expect(rawCoins(state, BOB)).toBe(3);
  expect(rawCoins(state, DAN)).toBe(0);
  expect(rawCoins(state, CARA)).toBe(2);
});

test("Communist: a wealthiest actor still robs the richest other seat", () => {
  let state = craftSet(
    specialSet("communist"),
    [[ANN, ["communist", "banker"]]],
    "comm-actor-rich",
  );
  state = withCoins(state, ANN, 8);
  state = withCoins(state, BOB, 5);
  state = withCoins(state, CARA, 1);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Bob is the richest other seat; Ann's own purse is untouched by the steal.
  expect(rawCoins(state, BOB)).toBe(2);
  expect(rawCoins(state, CARA)).toBe(4);
  expect(rawCoins(state, ANN)).toBe(8);
});

test("Customs Officer: take the Tax tokens and mark a role", () => {
  let state = craftSet(
    specialSet("customs-officer"),
    [[ANN, ["customs-officer", "banker"]]],
    "customs-action",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "customs-officer", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("customs-mark");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  expect(state.tax).toEqual({ role: "banker", holder: ANN });
});

test("Customs Officer: the tax is charged before the challenge window", () => {
  let state = craftSet(specialSet("customs-officer"), [[BOB, ["banker", "banker"]]], "customs-tax");
  // Ann holds the tax on Banker; Ann's income hands the turn to Bob.
  state = { ...state, tax: { role: "banker", holder: ANN } };
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  // The tax is paid to Ann the moment Bob claims, before any challenge.
  expect(rawCoins(state, BOB)).toBe(1);
  expect(rawCoins(state, ANN)).toBe(4);
  expect(openPurpose(state)).toBe("challenge-claim");
});

test("Customs Officer: a new claim moves the mark", () => {
  let state = craftSet(
    specialSet("customs-officer"),
    [[BOB, ["customs-officer", "banker"]]],
    "customs-move",
  );
  state = { ...state, tax: { role: "banker", holder: ANN }, active: ANN };
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "customs-officer", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: ANN } : null,
  );
  expect(state.tax).toEqual({ role: "guerrilla", holder: BOB });
});

test("Customs Officer: a Spy pays the Tax on both claims of the taxed role", () => {
  let state = craftSet(
    ["spy", "director", "guerrilla", "customs-officer", "politician"],
    [[ANN, ["spy", "banker"]]],
    "customs-spy",
  );
  state = withTax(state, "spy", CARA);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("spy-second");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "spy", target: null } : null,
  );
  // Both Spy claims of the taxed role pay: the holder gains 2.
  expect(rawCoins(state, CARA)).toBe(4);
  expect(openPurpose(state)).toBe("challenge-claim");
});

test("Customs Officer: the holder keeps the Tax when the taxed claim fails", () => {
  let state = craftSet(
    specialSet("customs-officer"),
    [[BOB, ["guerrilla", "guerrilla"]]],
    "customs-fail",
  );
  state = withTax(state, "banker", CARA);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  expect(rawCoins(state, CARA)).toBe(3);
  state = advance(state, (seat) => (seat === ANN ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  // The claim failed, but the Tax was charged before the challenge and is kept.
  expect(rawCoins(state, CARA)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(1);
});

test("Foreign Consular: take a Treaty token and ally with another player", () => {
  let state = craftSet(
    specialSet("foreign-consular"),
    [[ANN, ["foreign-consular", "banker"]]],
    "consular-action",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "foreign-consular", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(state.treaty).toEqual([ANN, BOB]);
});

test("Foreign Consular: allies cannot target each other", () => {
  let state = withCoins(
    craftSet(specialSet("foreign-consular"), [[ANN, ["guerrilla", "banker"]]], "consular-ally"),
    ANN,
    4,
  );
  state = { ...state, treaty: [ANN, BOB] };
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  // The illegal ally target coerces to Income.
  expect(rawCoins(state, ANN)).toBe(5);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Foreign Consular: an ally may challenge an ally", () => {
  let state = craftSet(
    specialSet("foreign-consular"),
    [[ANN, ["foreign-consular", "banker"]]],
    "consular-ally-challenge",
  );
  state = withTreaty(state, [ANN, BOB]);
  // Ann cannot target her ally Bob, so she names Cara; Bob may still challenge her.
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "foreign-consular", target: CARA } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  expect(openPurpose(state)).toBe("proof-claim");
  expect(state.pending?.challenger).toBe(BOB);
});

test("Foreign Consular: a successful challenge costs a life and no treaty forms", () => {
  let state = craftSet(
    specialSet("foreign-consular"),
    [[ANN, ["banker", "banker"]]],
    "consular-lie",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "foreign-consular", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(state.treaty).toEqual([]);
});

test("Foreign Consular: a failed challenge costs the challenger a life, then the treaty forms", () => {
  let state = craftSet(
    specialSet("foreign-consular"),
    [[ANN, ["foreign-consular", "banker"]]],
    "consular-true",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "foreign-consular", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(state.treaty).toEqual([ANN, BOB]);
});

test("Peacekeeping: a former holder is targetable once the token is stolen", () => {
  let state = craftSet(
    specialSet("peacekeeper"),
    [
      [ANN, ["banker", "banker"]],
      [BOB, ["peacekeeper", "banker"]],
      [CARA, ["politician", "banker"]],
    ],
    "peace-former",
  );
  state = withPeacekeeping(state, ANN);
  // Ann's income hands the turn to Bob, who steals the token from her.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(state.active).toBe(BOB);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "peacekeeper", target: null } : null,
  );
  state = advance(state, pass);
  expect(state.peacekeeping).toBe(BOB);
  expect(state.active).toBe(CARA);
  // Ann no longer holds the token, so Cara's Politician claim on her is legal.
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: ANN } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Ann was robbed of 2 (3 after her income); had she still held the token the
  // claim would have coerced to Income instead.
  expect(rawCoins(state, ANN)).toBe(1);
  expect(rawCoins(state, CARA)).toBe(4);
});

test("Peacekeeping: a Politician cannot steal from the holder", () => {
  let state = withPeacekeeping(
    craftSet(specialSet("peacekeeper"), [[ANN, ["politician", "banker"]]], "peace-politician"),
    BOB,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "politician", target: BOB } : null,
  );
  // The shielded target coerces the claim to Income.
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(2);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Peacekeeping: the holder is skipped as the Communist victim", () => {
  let state = withPeacekeeping(
    craftSet(specialSet("communist"), [[ANN, ["communist", "banker"]]], "peace-communist"),
    BOB,
  );
  state = withCoins(state, ANN, 0);
  state = withCoins(state, BOB, 8);
  state = withCoins(state, CARA, 5);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "communist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Bob would be the wealthiest, but the token skips him: Cara is robbed instead.
  expect(rawCoins(state, BOB)).toBe(8);
  expect(rawCoins(state, CARA)).toBe(2);
  expect(rawCoins(state, ANN)).toBe(3);
});

test("Peacekeeping: a Protestor cannot target the holder", () => {
  let state = withPeacekeeping(
    withCoins(
      craftSet(specialSet("protestor"), [[ANN, ["protestor", "banker"]]], "peace-protestor"),
      ANN,
      5,
    ),
    BOB,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "protestor", target: BOB } : null,
  );
  // The shielded target coerces the claim to Income.
  expect(rawCoins(state, ANN)).toBe(6);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

test("Priest: all other players give 1 coin if able", () => {
  let state = craftSet(specialSet("priest"), [[ANN, ["priest", "banker"]]], "priest-action");
  state = withCoins(state, CARA, 0);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "priest", target: null } : null,
  );
  state = advance(state, pass);
  // Two per-payer block windows open, clockwise from Ann.
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  state = advance(state, pass);
  // Bob paid 1; Cara had 0 and paid 0.
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(1);
  expect(rawCoins(state, CARA)).toBe(0);
  expect(openPurpose(state)).toBe("turn");
});

test("Priest: a payer blocks their own payment only", () => {
  let state = craftSet(specialSet("priest"), [[BOB, ["priest", "banker"]]], "priest-block");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "priest", target: null } : null,
  );
  state = advance(state, pass);
  // Bob blocks his own payment; Cara does not.
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "priest" } : null));
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(2);
  expect(rawCoins(state, CARA)).toBe(1);
});

test("Priest: a successful challenge costs a life and the collection fails", () => {
  let state = craftSet(specialSet("priest"), [[ANN, ["banker", "banker"]]], "priest-lie");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "priest", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, ANN)).toHaveLength(1);
  expect(rawCoins(state, BOB)).toBe(2);
});

test("Priest: a failed challenge costs the challenger a life, then the collection lands", () => {
  let state = craftSet(specialSet("priest"), [[ANN, ["priest", "banker"]]], "priest-true");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "priest", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(4);
});

test("Priest: a Peacekeeping holder pays nothing and is owed no window", () => {
  let state = withPeacekeeping(
    craftSet(specialSet("priest"), [[ANN, ["priest", "banker"]]], "priest-peace"),
    BOB,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "priest", target: null } : null,
  );
  state = advance(state, pass);
  // Only Cara is owed a payment window; the Peacekeeping holder Bob is skipped.
  expect(seatsOwedAt(state)).toEqual([CARA]);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawCoins(state, BOB)).toBe(2);
  expect(rawCoins(state, CARA)).toBe(1);
  expect(openPurpose(state)).toBe("turn");
});

test("Priest: a treaty ally is still reached", () => {
  let state = withTreaty(
    craftSet(specialSet("priest"), [[ANN, ["priest", "banker"]]], "priest-ally"),
    [ANN, BOB],
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "priest", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  state = advance(state, pass);
  // The ally Bob pays his coin like any other seat.
  expect(rawCoins(state, ANN)).toBe(4);
  expect(rawCoins(state, BOB)).toBe(1);
});

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

test("Arms Dealer: a match on either flipped card pays 4 and leaves the deck unchanged", () => {
  const cards = totalCards(craftSet(specialSet("arms-dealer"), [], "arms-count"));
  let state = withCourt(
    craftSet(specialSet("arms-dealer"), [[ANN, ["arms-dealer", "banker"]]], "arms-match"),
    ["banker", "banker", "director", "guerrilla", "politician", "peacekeeper", "banker", "banker", "banker"],
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "arms-dealer", target: null, named: "banker" } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(6);
  expect(state.arms).toEqual({ seat: ANN, named: "banker", cards: ["banker", "banker"], matched: true });
  expect(totalCards(state)).toBe(cards);
});

test("Arms Dealer: no match pays nothing", () => {
  let state = withCourt(
    craftSet(specialSet("arms-dealer"), [[ANN, ["arms-dealer", "banker"]]], "arms-miss"),
    ["director", "guerrilla", "banker", "banker", "politician", "peacekeeper", "banker", "banker", "banker"],
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "arms-dealer", target: null, named: "banker" } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(2);
  expect(state.arms?.matched).toBe(false);
});

test("Arms Dealer: a double match still pays 4, not 8", () => {
  let state = withCourt(
    craftSet(specialSet("arms-dealer"), [[ANN, ["arms-dealer", "banker"]]], "arms-double"),
    ["banker", "banker", "banker", "banker", "banker", "banker", "banker", "banker", "banker"],
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "arms-dealer", target: null, named: "banker" } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(6);
});

test("Socialist: each target gives a coin or a card; the actor keeps one and deals the rest back", () => {
  let state = craftSet(specialSet("socialist"), [[ANN, ["socialist", "banker"]]], "soc-give");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "socialist", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("socialist-give");
  state = advance(state, (seat) => (seat === BOB ? { t: "pay" } : null));
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("socialist-give");
  state = advance(state, (seat) => (seat === CARA ? { t: "give", index: 0 } : null));
  expect(openPurpose(state)).toBe("socialist-keep");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [0, 2] } : null));
  // Ann collected Bob's coin and swapped one card with Cara: every hand size holds.
  expect(rawCoins(state, ANN)).toBe(3);
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(rawHand(state, BOB)).toHaveLength(2);
  expect(rawHand(state, CARA)).toHaveLength(2);
  expect(totalCards(state)).toBe(15);
  expect(totalCoins(state)).toBe(50);
});

test("Socialist: a target with no coins must give a card", () => {
  let state = withCoins(
    craftSet(specialSet("socialist"), [[ANN, ["socialist", "banker"]]], "soc-nocoin"),
    BOB,
    0,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "socialist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, pass);
  // Bob reports `pay` but holds no coins, so the coercion takes a card instead.
  state = advance(state, (seat) => (seat === BOB ? { t: "pay" } : null));
  expect(state.socialist?.givers).toEqual([BOB]);
  expect(state.socialist?.pool).toHaveLength(1);
  expect(rawHand(state, BOB)).toHaveLength(1);
});

test("Socialist: a blocking target keeps their stake and gives nothing", () => {
  let state = withCoins(
    craftSet(specialSet("socialist"), [[ANN, ["socialist", "banker"]]], "soc-block"),
    BOB,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "socialist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "socialist" } : null));
  // The block opens its own challenge window; Cara declines to challenge it.
  state = advance(state, pass);
  expect(rawCoins(state, BOB)).toBe(3);
  expect(rawHand(state, BOB)).toHaveLength(2);
  // Cara's own give window still opens.
  expect(openPurpose(state)).toBe("block");
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("socialist-give");
});

test("Socialist: a challenged block costs a life but the give still runs", () => {
  let state = withCoins(
    craftSet(specialSet("socialist"), [[ANN, ["socialist", "banker"]]], "soc-blocklie"),
    BOB,
    3,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "socialist", target: null } : null,
  );
  state = advance(state, pass);
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "socialist" } : null));
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "concede" } : null));
  // The failed block costs Bob a life, then his give window opens.
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  expect(rawHand(state, BOB)).toHaveLength(1);
  expect(openPurpose(state)).toBe("socialist-give");
});
