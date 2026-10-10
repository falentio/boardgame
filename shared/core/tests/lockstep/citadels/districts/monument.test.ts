import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import {
  monument,
  monumentScoring,
  monumentTriggers,
} from "../../../../lockstep/games/citadels/districts/monument.ts";
import { tryBuild } from "../../../../lockstep/games/citadels/helpers.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  rawGenesis,
  rawGold,
  rawHand,
  rawPlayer,
  rawRandom,
  withGold,
  withHand,
} from "../driver.ts";

const placed = (id: string): PlacedDistrict => ({ id, gold: 0 });

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

/** ANN's turn window is open and the round closes beneath it. */
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

const cityOf = (state: CitadelsState, seat: SeatId): readonly PlacedDistrict[] =>
  rawPlayer(state, seat).city;

const FIVE_DISTRICTS: readonly PlacedDistrict[] = [
  placed("watchtower"),
  placed("prison"),
  placed("temple"),
  placed("tavern"),
  placed("manor"),
];

test("you cannot build the Monument when your city already has five districts", () => {
  const state = withHand(withGold(turnState(FIVE_DISTRICTS), ANN, 10), ANN, ["monument"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN)).toHaveLength(5);
  expect(rawHand(next, ANN)).toEqual(["monument"]);
  expect(rawGold(next, ANN)).toBe(10);
});

test("the five-district ceiling holds at six and seven districts too", () => {
  for (const city of [
    [...FIVE_DISTRICTS, placed("church")],
    [...FIVE_DISTRICTS, placed("church"), placed("monastery")],
  ]) {
    const state = withHand(withGold(turnState(city), ANN, 10), ANN, ["monument"]);
    const next = tryBuild(state, ANN, 0, rawRandom());
    expect(cityOf(next, ANN)).toHaveLength(city.length);
    expect(rawHand(next, ANN)).toEqual(["monument"]);
    expect(rawGold(next, ANN)).toBe(10);
  }
});

test("you may build the Monument while your city has four districts, paying its cost", () => {
  const four = FIVE_DISTRICTS.slice(0, 4);
  const state = withHand(withGold(turnState(four), ANN, 10), ANN, ["monument"]);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityOf(next, ANN).map((district) => district.id)).toEqual([
    ...four.map((district) => district.id),
    "monument",
  ]);
  expect(rawGold(next, ANN)).toBe(10 - specOfDistrict("monument").cost);
  expect(rawHand(next, ANN)).toEqual([]);
});

test("the Monument counts as two districts at end of game: its cost scores a second time", () => {
  const city: readonly PlacedDistrict[] = [placed("monument"), placed("watchtower")];
  const state = withCity(rawGenesis(SEATS3, BASE_CAST_IDS), ANN, city);
  expect(monumentScoring(city[0]!, city, ANN, state)).toBe(specOfDistrict("monument").cost);
  const ann = scoreGame(state).find((score) => score.seat === ANN);
  // Cost sum 4 + 1; the second district adds the Monument's cost again as unique points.
  expect(ann?.districts).toBe(5);
  expect(ann?.unique).toBe(4);
  expect(ann?.total).toBe(9);
});

test("the ability is not a no-op: the gate refuses a sixth district and the score pays twice", () => {
  const six = [...FIVE_DISTRICTS, placed("church")];
  const blocked = tryBuild(
    withHand(withGold(turnState(six), ANN, 10), ANN, ["monument"]),
    ANN,
    0,
    rawRandom(),
  );
  expect(cityOf(blocked, ANN)).toHaveLength(6);
  const city: readonly PlacedDistrict[] = [placed("monument")];
  expect(monumentScoring(city[0]!, city, ANN, turnState([]))).toBeGreaterThan(0);
});

test("the Monument declares the onBuild trigger and its in-play effect is a no-op", () => {
  expect(monumentTriggers).toEqual(["onBuild"]);
  const state = turnState([]);
  expect(monument({ state, owner: ANN, city: [], rest: [], rng: rawRandom() })).toBe(state);
});
