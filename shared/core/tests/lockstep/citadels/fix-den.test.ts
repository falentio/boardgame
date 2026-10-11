import { expect, test } from "vitest";
import { specOfDistrict } from "../../../lockstep/games/citadels/districts.ts";
import { thievesDenBuild } from "../../../lockstep/games/citadels/districts/thieves-den.ts";
import { tryBuild } from "../../../lockstep/games/citadels/helpers.ts";
import type { CitadelsState } from "../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  rawGenesis,
  rawGold,
  rawHand,
  rawPlayer,
  rawRandom,
  totalCards,
  withGold,
  withHand,
} from "./driver.ts";

/** ANN's turn window is open and the round closes beneath it. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, BASE_CAST_IDS),
  phase: "turn",
  draft: null,
  active: ANN,
  steps: [
    { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
    { kind: "end-round" },
  ],
});

const cityOf = (state: CitadelsState): readonly string[] =>
  rawPlayer(state, ANN).city.map((district) => district.id);

const DEN_COST = specOfDistrict("thieves-den").cost;

test("the query offers the card share of any split, not only a wholly-insufficient purse", () => {
  // 2 gold covers half the cost-4 Den, so the card share is the 2-gold shortfall.
  const mixed = withHand(withGold(turnState(), ANN, 2), ANN, ["thieves-den", "tavern", "market"]);
  expect(thievesDenBuild({ state: mixed, seat: ANN, card: "thieves-den", city: [] })).toEqual({
    payCards: 2,
  });
  // An affordable Den names no card share; an empty purse names the whole cost.
  const rich = withHand(withGold(turnState(), ANN, 9), ANN, ["thieves-den", "tavern"]);
  expect(thievesDenBuild({ state: rich, seat: ANN, card: "thieves-den", city: [] })).toEqual({
    payCards: 0,
  });
  const broke = withHand(withGold(turnState(), ANN, 0), ANN, ["thieves-den", "tavern"]);
  expect(thievesDenBuild({ state: broke, seat: ANN, card: "thieves-den", city: [] })).toEqual({
    payCards: DEN_COST,
  });
  // The terms answer only for the Den itself.
  expect(thievesDenBuild({ state: mixed, seat: ANN, card: "tavern", city: [] })).toEqual({});
});

test("the Thieves' Den may be paid partly in gold and partly in cards", () => {
  // 2 gold and 2 spare cards on a cost-4 Den: the rule allows any split, so the
  // build is accepted rather than refused for gold being insufficient, and the
  // 2-gold shortfall is covered by the two spare cards.
  const state = withHand(withGold(turnState(), ANN, 2), ANN, ["thieves-den", "tavern", "market"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next)).toEqual(["thieves-den"]);
  expect(next.discard).toEqual(["tavern", "market"]);
  expect(rawHand(next, ANN)).toEqual([]);
  expect(totalCards(next)).toBe(totalCards(state));
});

test("the engine builds the split end to end through a turn window", () => {
  const state = withHand(withGold(turnState(), ANN, 2), ANN, ["thieves-den", "tavern", "market"]);
  const next = advance(state, (seat) => (seat === ANN ? { t: "build", card: 0 } : null));
  expect(cityOf(next)).toEqual(["thieves-den"]);
  expect(next.discard).toEqual(["tavern", "market"]);
  expect(totalCards(next)).toBe(totalCards(state));
});

test("a fully-card payment spends no gold and consumes the whole cost in cards", () => {
  const state = withHand(
    withGold(turnState(), ANN, 0),
    ANN,
    ["thieves-den", "manor", "castle", "docks", "harbor"],
  );
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next)).toEqual(["thieves-den"]);
  expect(rawGold(next, ANN)).toBe(0);
  expect(rawHand(next, ANN)).toEqual([]);
  expect(next.discard).toEqual(["manor", "castle", "docks", "harbor"]);
  expect(totalCards(next)).toBe(totalCards(state));
});

test("a fully-gold payment keeps every card and charges the catalog cost", () => {
  const state = withHand(withGold(turnState(), ANN, 10), ANN, ["thieves-den", "manor"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next)).toEqual(["thieves-den"]);
  expect(rawGold(next, ANN)).toBe(10 - DEN_COST);
  expect(rawHand(next, ANN)).toEqual(["manor"]);
  expect(next.discard).toEqual([]);
  expect(totalCards(next)).toBe(totalCards(state));
});

test("a hand too thin to cover the gold shortfall still refuses the build", () => {
  // 2 gold leaves a 2-card share, but only one spare card sits beside the Den.
  const state = withHand(withGold(turnState(), ANN, 2), ANN, ["thieves-den", "manor"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next)).toEqual([]);
  expect(rawHand(next, ANN)).toEqual(["thieves-den", "manor"]);
  expect(rawGold(next, ANN)).toBe(2);
});
