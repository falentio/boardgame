import { expect, test } from "vitest";
import { type SeatId } from "../../../../index.ts";
import { dragonGateScoring } from "../../../../lockstep/games/citadels/districts/dragon-gate.ts";
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

const uniqueOf = (state: CitadelsState, seat: SeatId): number =>
  scoreGame(state).find((score) => score.seat === seat)?.unique ?? 0;

test("the Dragon Gate scores exactly 2 extra points", () => {
  const city = [placed("watchtower"), placed("dragon-gate")];
  expect(dragonGateScoring(placed("dragon-gate"), city, ANN)).toBe(2);
});

test("the flat bonus does not grow with the rest of the city", () => {
  const small = [placed("dragon-gate")];
  const large = [placed("dragon-gate"), placed("palace"), placed("fortress"), placed("cathedral")];
  expect(dragonGateScoring(placed("dragon-gate"), small, ANN)).toBe(2);
  expect(dragonGateScoring(placed("dragon-gate"), large, ANN)).toBe(2);
});

test("the exact extra points reach the score through the engine's scoring pass", () => {
  const state = withCity(rawGenesis(SEATS3), ANN, [placed("watchtower"), placed("dragon-gate")]);
  const ann = scoreGame(state).find((score) => score.seat === ANN);
  // District costs: 1 + 6 = 7; 2 Dragon Gate points; no five-colour bonus.
  expect(ann?.unique).toBe(2);
  expect(ann?.districts).toBe(7);
  expect(ann?.total).toBe(9);
});

test("the ability is not a no-op: the engine credits 2 where the same city without the gate credits 0", () => {
  const genesis = rawGenesis(SEATS3);
  const withGate = uniqueOf(withCity(genesis, ANN, [placed("watchtower"), placed("dragon-gate")]), ANN);
  const withoutGate = uniqueOf(withCity(genesis, ANN, [placed("watchtower")]), ANN);
  expect(withGate).toBe(2);
  expect(withoutGate).toBe(0);
});
