import { expect, test } from "vitest";
import { type SeatId } from "../../../../index.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import { basilicaScoring } from "../../../../lockstep/games/citadels/districts/basilica.ts";
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

test("the Basilica scores 1 point for each district of odd cost in the city", () => {
  // Watchtower 1, Temple 1, Manor 3 are odd; Prison 2 and the Basilica 6 are even.
  const city = [
    placed("watchtower"),
    placed("prison"),
    placed("temple"),
    placed("manor"),
    placed("basilica"),
  ];
  expect(basilicaScoring(placed("basilica"), city, ANN, rawGenesis(SEATS3))).toBe(3);
});

test("a city of only even-cost districts scores no Basilica points", () => {
  const city = [placed("prison"), placed("church"), placed("basilica")];
  expect(basilicaScoring(placed("basilica"), city, ANN, rawGenesis(SEATS3))).toBe(0);
});

test("the exact extra points reach the score through the engine's scoring pass", () => {
  const state = withCity(rawGenesis(SEATS3), ANN, [
    placed("watchtower"),
    placed("prison"),
    placed("temple"),
    placed("manor"),
    placed("basilica"),
  ]);
  const ann = scoreGame(state).find((score) => score.seat === ANN);
  // District costs: 1 + 2 + 1 + 3 + 6 = 13; no five-colour bonus; 3 Basilica points.
  expect(ann?.unique).toBe(3);
  expect(ann?.districts).toBe(13);
  expect(ann?.total).toBe(16);
});

test("the ability is not a no-op: a city of odd-cost districts scores more than zero", () => {
  const city = [placed("watchtower"), placed("basilica")];
  const points = basilicaScoring(placed("basilica"), city, ANN, rawGenesis(SEATS3));
  expect(points).toBeGreaterThan(0);
  expect(points).toBe(
    city.filter((district) => specOfDistrict(district.id).cost % 2 === 1).length,
  );
});
