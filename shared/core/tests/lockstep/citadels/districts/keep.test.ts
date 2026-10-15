import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import {
  keep,
  keepProtects,
  keepScoring,
  keepTriggers,
} from "../../../../lockstep/games/citadels/districts/keep.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import type { PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import { ANN, SEATS3, rawGenesis, rawPlayer, rawRandom } from "../driver.ts";

const keepState = () => rawGenesis(SEATS3);

const ctxFor = (seat: SeatId) => {
  const state = keepState();
  return { state, owner: seat, city: rawPlayer(state, seat).city, rest: [], rng: rawRandom() };
};

const cityOf = (ids: readonly string[]): readonly PlacedDistrict[] =>
  ids.map((id) => ({ id, gold: 0 }));

test("the Warlord cannot destroy the Keep: the guard vetoes the Keep", () => {
  expect(keepProtects("keep")).toBe(true);
});

test("the guard vetoes only the Keep, so every other district is destroyable", () => {
  expect(keepProtects("palace")).toBe(false);
  expect(keepProtects("great-wall")).toBe(false);
  expect(keepProtects("armory")).toBe(false);
  expect(keepProtects("tavern")).toBe(false);
});

test("the effect is not a no-op: the guard fires for the Keep and only the Keep", () => {
  const vetoed = ["keep", "tavern", "palace", "watchtower"].filter((id) => keepProtects(id));
  expect(vetoed).toEqual(["keep"]);
});

test("the Keep declares the onDestroy hook the engine consults before a destroy", () => {
  expect(keepTriggers).toEqual(["onDestroy"]);
});

test("the Keep mutates no state: its effect is the guard, not a rewrite", () => {
  const ctx = ctxFor(ANN);
  const next = keep(ctx);
  expect(next).toEqual(ctx.state);
});

test("the Keep scores no extra points of its own on a crafted city", () => {
  const city = cityOf(["keep", "palace", "tavern"]);
  const placed = city[0];
  if (placed === undefined) throw new Error("no keep placed");
  expect(keepScoring(placed, city, ANN, rawGenesis(SEATS3))).toBe(0);
  expect(specOfDistrict("keep").cost).toBe(3);
});
