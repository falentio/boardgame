import { expect, test } from "vitest";
import { type SeatId } from "../../../../index.ts";
import { capitolScoring } from "../../../../lockstep/games/citadels/districts/capitol.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import { ANN, SEATS3, rawGenesis } from "../driver.ts";

const placed = (id: string): PlacedDistrict => ({ id, gold: 0 });

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

test("the Capitol scores 3 when the city has at least three districts of one type", () => {
  // Three military districts alongside the Capitol.
  const city = [placed("watchtower"), placed("prison"), placed("barracks"), placed("capitol")];
  expect(capitolScoring(placed("capitol"), city, ANN, rawGenesis(SEATS3))).toBe(3);
});

test("a city with no three districts of any one type scores nothing", () => {
  const city = [placed("watchtower"), placed("prison"), placed("temple"), placed("capitol")];
  expect(capitolScoring(placed("capitol"), city, ANN, rawGenesis(SEATS3))).toBe(0);
});

test("the Capitol scores only once even with two qualifying types", () => {
  const city = [
    placed("watchtower"),
    placed("prison"),
    placed("barracks"),
    placed("temple"),
    placed("church"),
    placed("monastery"),
    placed("capitol"),
  ];
  expect(capitolScoring(placed("capitol"), city, ANN, rawGenesis(SEATS3))).toBe(3);
});

test("the exact extra points reach the score through the engine's scoring pass", () => {
  const state = withCity(rawGenesis(SEATS3), ANN, [
    placed("watchtower"),
    placed("prison"),
    placed("barracks"),
    placed("capitol"),
  ]);
  const ann = scoreGame(state).find((score) => score.seat === ANN);
  // District costs: 1 + 2 + 3 + 5 = 11; 3 Capitol points; no five-colour bonus.
  expect(ann?.unique).toBe(3);
  expect(ann?.districts).toBe(11);
  expect(ann?.total).toBe(14);
});

test("the ability is not a no-op: three of a type moves the score above zero", () => {
  const city = [placed("watchtower"), placed("prison"), placed("barracks"), placed("capitol")];
  expect(capitolScoring(placed("capitol"), city, ANN, rawGenesis(SEATS3))).toBeGreaterThan(0);
});
