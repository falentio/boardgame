import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import {
  monument,
  monumentBuild,
  monumentScoring,
  monumentTriggers,
} from "../../../../lockstep/games/citadels/districts/monument.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import { tryBuild } from "../../../../lockstep/games/citadels/helpers.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawGold,
  rawHand,
  rawPlayer,
  rawRandom,
  totalCards,
  withGold,
  withHand,
} from "../driver.ts";

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

/** ANN's turn window is open, the round closes beneath it. */
const turnState = (city: readonly PlacedDistrict[]): CitadelsState =>
  withCity(
    {
      ...rawGenesis(SEATS3, BASE_CAST_IDS),
      phase: "turn",
      draft: null,
      active: ANN,
      steps: [
        { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
        { kind: "end-round" },
      ],
    },
    ANN,
    city,
  );

/** A city of `n` cheap districts, so its size is exactly `n`. */
const cityOfSize = (n: number): readonly PlacedDistrict[] =>
  Array.from({ length: n }, () => ({ id: "watchtower", gold: 0 }));

const cityOf = (state: CitadelsState, seat: SeatId): readonly PlacedDistrict[] =>
  rawPlayer(state, seat).city;

const ctxFor = (state: CitadelsState, card = "monument") => ({
  state,
  seat: ANN,
  card,
  city: rawPlayer(state, ANN).city,
});

test("you cannot build the Monument when your city already has five districts", () => {
  const state = withHand(withGold(turnState(cityOfSize(5)), ANN, 10), ANN, ["monument"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN)).toHaveLength(5);
  expect(rawHand(next, ANN)).toEqual(["monument"]);
  expect(rawGold(next, ANN)).toBe(10);
});

test("you cannot build the Monument when your city has more than five districts", () => {
  const state = withHand(withGold(turnState(cityOfSize(6)), ANN, 10), ANN, ["monument"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN)).toHaveLength(6);
  expect(rawHand(next, ANN)).toEqual(["monument"]);
});

test("you may build the Monument when your city has four districts, paying its cost", () => {
  const state = withHand(withGold(turnState(cityOfSize(4)), ANN, 10), ANN, ["monument"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN).map((district) => district.id)).toEqual([
    "watchtower",
    "watchtower",
    "watchtower",
    "watchtower",
    "monument",
  ]);
  // The catalog cost is four; the gate changed nothing about the price.
  expect(rawGold(next, ANN)).toBe(10 - specOfDistrict("monument").cost);
  expect(totalCards(next)).toBe(totalCards(state));
});

test("the build gate is the Monument's own card: a Monument in the city never gates another build", () => {
  // A city holding a Monument and four others is five districts, but a Tavern
  // build must still be allowed: the query answers only for the Monument.
  const city = [...cityOfSize(4), { id: "monument", gold: 0 }];
  const state = withHand(withGold(turnState(city), ANN, 10), ANN, ["tavern"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN).map((district) => district.id)).toContain("tavern");
  expect(cityOf(next, ANN)).toHaveLength(6);
});

test("the build gate refuses through the turn window, leaving the hand and gold untouched", () => {
  const state = withHand(withGold(turnState(cityOfSize(5)), ANN, 10), ANN, ["monument"]);
  const next = advance(state, () => ({ t: "build", card: 0 }));
  expect(cityOf(next, ANN)).toHaveLength(5);
  expect(rawHand(next, ANN)).toEqual(["monument"]);
  expect(rawGold(next, ANN)).toBe(10);
  // A refused build ends the turn rather than reopening the build window.
  expect(openPurpose(next)).not.toBe("turn");
});

test("the Monument counts as two districts: a crafted city scores its cost a second time", () => {
  const city: readonly PlacedDistrict[] = [
    { id: "monument", gold: 0 },
    { id: "watchtower", gold: 0 },
  ];
  const state = withCity(rawGenesis(SEATS3, BASE_CAST_IDS), ANN, [...city]);
  // The second district is the Monument's cost paid again as unique points.
  expect(monumentScoring(city[0]!, city, ANN, state)).toBe(specOfDistrict("monument").cost);
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum 4 + 1, plus the Monument's 4 as its second district.
  expect(score?.districts).toBe(5);
  expect(score?.unique).toBe(4);
  expect(score?.total).toBe(9);
});

test("two Monuments each count twice: a crafted city of two scores eight extra points", () => {
  const city: readonly PlacedDistrict[] = [
    { id: "monument", gold: 0 },
    { id: "monument", gold: 0 },
  ];
  const state = withCity(rawGenesis(SEATS3, BASE_CAST_IDS), ANN, [...city]);
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Two cards at cost 4 = 8 in districts, and each pays 4 again = 8 in unique.
  expect(score?.districts).toBe(8);
  expect(score?.unique).toBe(8);
  expect(score?.total).toBe(16);
});

test("the Monument declares the onBuild trigger and its build query is a real gate", () => {
  expect(monumentTriggers).toEqual(["onBuild"]);
  // A no-op query would answer {} and let the build through; this one refuses it.
  expect(monumentBuild(ctxFor(turnState(cityOfSize(5))))).toEqual({ legal: false });
  expect(monumentBuild(ctxFor(turnState(cityOfSize(4))))).toEqual({});
});

test("the effect is not a no-op: the same Monument build succeeds at four districts and fails at five", () => {
  const low = withHand(withGold(turnState(cityOfSize(4)), ANN, 10), ANN, ["monument"]);
  const high = withHand(withGold(turnState(cityOfSize(5)), ANN, 10), ANN, ["monument"]);
  const builtLow = rawHand(tryBuild(low, ANN, 0, rawRandom()), ANN).length;
  const builtHigh = rawHand(tryBuild(high, ANN, 0, rawRandom()), ANN).length;
  expect(builtLow).toBe(0);
  expect(builtHigh).toBe(1);
  expect(builtLow).not.toBe(builtHigh);
  // The effect body itself is inert: its rule lives in the build query and the scorer.
  expect(monument({ state: low, owner: ANN, city: cityOf(low, ANN), rest: [], rng: rawRandom() })).toEqual(
    low,
  );
});
