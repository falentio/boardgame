/**
 * The two Anarchy general actions (Bank, Social Media) and the general-action
 * registry. Bank replaces Income while Financier is in play; Social Media is a
 * challenge-free, block-free card swap. Totality under hostile reports is pinned
 * here too, since a general action is the fallback an illegal report coerces to.
 */
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
  totalCards,
  totalCoins,
  withBank,
  withCoins,
} from "./driver.ts";
import { g54 } from "../../../lockstep/games/g54/index.ts";
import type { RoleId } from "../../../lockstep/games/g54/roles.ts";
import { fallbackGeneral, generalActionsFor } from "../../../lockstep/games/g54/generals.ts";

const pass = (): null => null;

/** A set with Financier in play, so Bank replaces Income. */
const BANK_SET: readonly RoleId[] = ["financier", "director", "guerrilla", "arms-dealer", "socialist"];
const PLAIN_SET: readonly RoleId[] = ["banker", "director", "guerrilla", "arms-dealer", "socialist"];

test("generalActionsFor swaps Income for Bank while Financier is in play", () => {
  const withFinancier = craftSet(BANK_SET, [], "generals-fin");
  expect(generalActionsFor(withFinancier)).toEqual(["bank", "coup"]);
  expect(fallbackGeneral(withFinancier)).toBe("bank");

  const without = craftSet(PLAIN_SET, [], "generals-no-fin");
  expect(generalActionsFor(without)).toEqual(["income", "coup"]);
  expect(fallbackGeneral(without)).toBe("income");
});

test("generalActionsFor adds Social Media only when the setup flag is set", () => {
  const off = craftSet(PLAIN_SET, [], "generals-sm-off");
  expect(generalActionsFor(off)).toEqual(["income", "coup"]);
  const on = craftSet(PLAIN_SET, [], "generals-sm-on", undefined, { socialMedia: true });
  expect(generalActionsFor(on)).toEqual(["income", "coup", "social-media"]);
});

test("Bank: 1 coin moves from the Treasury into the public pile, never the purse", () => {
  let state = withCoins(craftSet(BANK_SET, [[ANN, ["banker", "banker"]]], "bank-move"), ANN, 2);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "bank" } : null));
  expect(rawCoins(state, ANN)).toBe(2);
  expect(state.bank).toBe(1);
  expect(g54.project(state, ANN).bank).toBe(1);
  expect(state.active).toBe(BOB);
});

test("Bank: the pile grows until a Financier sweeps it", () => {
  let state = withBank(
    withCoins(craftSet(BANK_SET, [[ANN, ["financier", "banker"]]], "bank-sweep"), ANN, 2),
    5,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "financier", target: null } : null,
  );
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(7);
  expect(state.bank).toBe(0);
});

test("Bank: a pile built across turns is swept by a single Financier claim", () => {
  let state = withCoins(craftSet(BANK_SET, [[ANN, ["financier", "banker"]]], "bank-across"), ANN, 2);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "bank" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "bank" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "bank" } : null));
  expect(state.bank).toBe(3);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "financier", target: null } : null,
  );
  state = advance(state, pass);
  expect(state.bank).toBe(0);
  expect(rawCoins(state, ANN)).toBe(5);
});

test("Social Media: a swap with no challenge and no block window", () => {
  const before = craftSet(PLAIN_SET, [[ANN, ["banker", "banker"]]], "sm-swap", undefined, {
    socialMedia: true,
  });
  const cards = totalCards(before);
  let state = advance(before, (seat, s) => (seat === s.active ? { t: "social-media" } : null));
  // No challenge window: the keep window opens directly.
  expect(openPurpose(state)).toBe("keep");
  expect(state.draw?.pool).toHaveLength(1);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [0] } : null));
  // The swap preserves the hand size and the 15-card deck.
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(totalCards(state)).toBe(cards);
  expect(state.active).toBe(BOB);
});

test("Social Media: the drawn card is visible only to the actor", () => {
  const before = craftSet(PLAIN_SET, [[ANN, ["banker", "banker"]]], "sm-redact", undefined, {
    socialMedia: true,
  });
  const state = advance(before, (seat, s) => (seat === s.active ? { t: "social-media" } : null));
  expect(openPurpose(state)).toBe("keep");
  expect(g54.project(state, ANN).myDraw).toHaveLength(1);
  expect(g54.project(state, BOB).myDraw).toBeNull();
});

test("Social Media: a coin-conserving general action", () => {
  const before = craftSet(PLAIN_SET, [], "sm-coins", undefined, { socialMedia: true });
  const coins = totalCoins(before);
  let state = advance(before, (seat, s) => (seat === s.active ? { t: "social-media" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "keep", indices: [0] } : null));
  expect(totalCoins(state)).toBe(coins);
});

test("a Bank report with no Financier in play coerces to the fallback general action", () => {
  let state = craftSet(PLAIN_SET, [[ANN, ["banker", "banker"]]], "bank-illegal");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "bank" } : null));
  // Bank is not in the menu, so the report becomes Income.
  expect(rawCoins(state, ANN)).toBe(3);
  expect(state.bank).toBe(0);
});

test("a Social Media report with the flag off coerces to the fallback general action", () => {
  let state = craftSet(PLAIN_SET, [[ANN, ["banker", "banker"]]], "sm-illegal");
  state = advance(state, (seat, s) => (seat === s.active ? { t: "social-media" } : null));
  expect(rawCoins(state, ANN)).toBe(3);
  expect(state.draw).toBeNull();
});

test("the view exposes the general action menu and the Social Media flag", () => {
  const state = craftSet(BANK_SET, [], "view-generals", undefined, { socialMedia: true });
  const view = g54.project(state, CARA);
  expect(view.generalActions).toEqual(["bank", "coup", "social-media"]);
  expect(view.socialMedia).toBe(true);
  expect(view.bank).toBe(0);
});

test("hostile reports coerce to the fallback general action, never throwing", () => {
  const hostile: readonly (import("./driver.ts").G54Action | null)[] = [
    null,
    { t: "pass" },
    { t: "claim", role: "guerrilla", target: ANN },
    { t: "claim", role: "anarchist", target: ANN },
    { t: "coup", target: ANN },
    { t: "bank" },
  ];
  // With Financier in play the fallback is Bank: every illegal report still
  // advances the turn and no frame throws.
  let state = craftSet(BANK_SET, [[ANN, ["banker", "banker"]]], "hostile-fin");
  for (const action of hostile) {
    const before = state.active;
    state = advance(state, (seat, s) => (seat === s.active ? action : null));
    expect(state.active).not.toBe(before);
  }
});

test("step is total across an Anarchy game under rotating hostile reports", () => {
  const HOSTILE: readonly (import("./driver.ts").G54Action | null)[] = [
    null,
    { t: "pass" },
    { t: "challenge" },
    { t: "show" },
    { t: "concede" },
    { t: "reveal", index: 999 },
    { t: "keep", indices: [9, 9] },
    { t: "give", index: 42 },
    { t: "block", role: "socialist" },
    { t: "pay" },
    { t: "no" },
    { t: "bank" },
    { t: "social-media" },
    { t: "claim", role: "anarchist", target: ANN },
    { t: "claim", role: "paramilitary", target: BOB },
    { t: "claim", role: "financier", target: null },
    { t: "claim", role: "socialist", target: null },
    { t: "coup", target: ANN },
  ];
  const roles: readonly RoleId[] = ["financier", "director", "anarchist", "arms-dealer", "socialist"];
  let state = craftSet(roles, [], "anarchy-hostile", undefined, { socialMedia: true });
  let cursor = 0;
  for (let i = 0; i < 3000 && !g54.isTerminal(state); i += 1) {
    const action = HOSTILE[cursor % HOSTILE.length] ?? null;
    cursor += 1;
    state = advance(state, (seat, s) => (seat === s.active ? action : null));
    // Every hostile frame advances without throwing; a non-terminal state keeps a stack.
    if (!g54.isTerminal(state)) expect(state.steps.length).toBeGreaterThan(0);
  }
  expect(g54.isTerminal(state) || state.steps.length > 0).toBe(true);
});
