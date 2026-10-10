import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import { statueScoring } from "../../../../lockstep/games/citadels/districts/statue.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import { ANN, BOB, SEATS3, rawGenesis } from "../driver.ts";

const placed = (id: string): PlacedDistrict => ({ id, gold: 0 });

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

const withCrown = (state: CitadelsState, seat: SeatId): CitadelsState => ({ ...state, crown: seat });

const annScore = (state: CitadelsState): number =>
  scoreGame(state).find((score) => score.seat === ANN)?.unique ?? 0;

test("the Statue scores 5 extra points when its owner holds the crown", () => {
  const city = [placed("watchtower"), placed("statue")];
  const state = withCrown(withCity(rawGenesis(SEATS3), ANN, city), ANN);
  expect(statueScoring(placed("statue"), city, ANN, state)).toBe(5);
});

test("the Statue scores nothing when another seat holds the crown", () => {
  const city = [placed("statue")];
  const state = withCrown(withCity(rawGenesis(SEATS3), ANN, city), BOB);
  expect(statueScoring(placed("statue"), city, ANN, state)).toBe(0);
});

test("the exact extra points reach the score through the engine's scoring pass", () => {
  const city = [placed("watchtower"), placed("statue")];
  const state = withCrown(withCity(rawGenesis(SEATS3), ANN, city), ANN);
  const ann = scoreGame(state).find((score) => score.seat === ANN);
  // District costs: 1 + 3 = 4; no five-colour bonus; 5 Statue points for the crown.
  expect(ann?.districts).toBe(4);
  expect(ann?.unique).toBe(5);
  expect(ann?.total).toBe(9);
});

test("the ability is not a no-op: the crown-holder scores 5 where the same city without the crown scores 0", () => {
  const genesis = rawGenesis(SEATS3);
  const city = [placed("statue")];
  const crowned = annScore(withCrown(withCity(genesis, ANN, city), ANN));
  const uncrowned = annScore(withCrown(withCity(genesis, ANN, city), BOB));
  expect(crowned).toBe(5);
  expect(uncrowned).toBe(0);
  expect(crowned).toBeGreaterThan(uncrowned);
});
