import { expect, test } from "vitest";
import { at } from "../harness.ts";
import {
  SEATS3,
  SEATS6,
  STARTER,
  advance,
  crafted,
  rawGenesis,
  tableOf,
  totalCards,
} from "./driver.ts";
import { G54Error } from "../../../lockstep/games/g54/error.ts";
import { ROLE_CATALOG, type RoleId } from "../../../lockstep/games/g54/roles.ts";
import { g54 } from "../../../lockstep/games/g54/index.ts";

test("the deck is 15 cards: three copies of each of the five chosen roles", () => {
  const state = rawGenesis(STARTER, SEATS3, "deck-shape");
  const counts = new Map<RoleId, number>();
  for (const card of state.court) counts.set(card, (counts.get(card) ?? 0) + 1);
  for (const player of state.players) {
    for (const card of player.hand) counts.set(card, (counts.get(card) ?? 0) + 1);
  }
  expect(totalCards(state)).toBe(15);
  for (const role of STARTER) expect(counts.get(role)).toBe(3);
  expect(counts.size).toBe(5);
});

test("each player starts with 2 coins and 2 face-down cards; the Court is the remainder", () => {
  const state = rawGenesis(STARTER, SEATS3, "deal");
  for (const player of state.players) {
    expect(player.coins).toBe(2);
    expect(player.hand).toHaveLength(2);
    expect(player.revealed).toHaveLength(0);
  }
  expect(state.court).toHaveLength(15 - 2 * SEATS3.length);
  // Treasury is the 50-coin supply minus the 2 dealt to each seat.
  expect(state.treasury).toBe(50 - 2 * SEATS3.length);
});

test("the starter set matches the documented first game", () => {
  const table = tableOf(STARTER, SEATS3, "starter-set");
  const view = at(table, SEATS3[0]).view();
  expect([...view.roles].sort()).toEqual([...STARTER].sort());
  expect(view.courtCount).toBe(9);
});

test("role selection enforces 1 Finance + 1 Communications + 1 Force + 2 Special Interest", () => {
  // Two Force, zero Finance.
  expect(() =>
    rawGenesis(["banker", "director", "guerrilla", "guerrilla", "politician"], SEATS3),
  ).toThrow(G54Error);
  // Only four roles.
  expect(() => rawGenesis(["banker", "director", "guerrilla", "politician"], SEATS3)).toThrow(
    G54Error,
  );
  // Duplicate roles.
  expect(() =>
    rawGenesis(["banker", "director", "guerrilla", "politician", "politician"], SEATS3),
  ).toThrow(G54Error);
});

test("the catalog holds all 25 roles in the documented category split", () => {
  expect(ROLE_CATALOG).toHaveLength(25);
  const byCategory = new Map<string, number>();
  for (const spec of ROLE_CATALOG) {
    byCategory.set(spec.category, (byCategory.get(spec.category) ?? 0) + 1);
  }
  expect(byCategory.get("finance")).toBe(5);
  expect(byCategory.get("communications")).toBe(5);
  expect(byCategory.get("force")).toBe(5);
  expect(byCategory.get("special-interest")).toBe(10);
});

test("the deck is conserved across a whole game: no fabricated cards on an empty Court", () => {
  // A six-seat game deals 12 cards, leaving a 3-card Court. Players keep claiming
  // Director (draw 2, return 2) and Guerrilla, so the Court must run empty and
  // draws must fall back to a partial action rather than invent cards.
  const start = rawGenesis(STARTER, SEATS6, "conservation");
  let state = start;
  let steps = 0;
  while (!g54.isTerminal(state) && steps < 20000) {
    state = advance(
      state,
      (seat, current) => {
        if (current.active !== seat) return null;
        const player = current.players.find((p) => p.seat === seat);
        if (player === undefined) return null;
        const target = current.players.find((p) => p.seat !== seat && p.hand.length > 0)?.seat;
        if (player.coins >= 7 && target !== undefined) return { t: "coup", target };
        if (player.coins >= 4 && target !== undefined) {
          return { t: "claim", role: "guerrilla", target };
        }
        if (current.turn % 2 === 0) return { t: "claim", role: "director", target: null };
        return { t: "income" };
      },
      "conservation",
    );
    steps += 1;
    // The 15-card deck never grows and never fabricates a card mid-game.
    expect(totalCards(state)).toBe(15);
  }
  expect(g54.isTerminal(state)).toBe(true);
  expect(totalCards(state)).toBe(15);
});

test("setup is deterministic for a given seed", () => {
  const a = rawGenesis(STARTER, SEATS3, "deterministic");
  const b = rawGenesis(STARTER, SEATS3, "deterministic");
  expect(a.court).toEqual(b.court);
  expect(a.players.map((p) => p.hand)).toEqual(b.players.map((p) => p.hand));
});

test("advancing is a pure function of the frame", () => {
  const start = crafted("purity");
  const step = (state: typeof start) =>
    advance(state, (seat) => (seat === start.active ? { t: "income" } : null));
  expect(step(start)).toEqual(step(start));
});
