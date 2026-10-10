import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import { imperialTreasuryScoring } from "../../../../lockstep/games/citadels/districts/imperial-treasury.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import { ANN, BOB, SEATS3, rawGenesis, withGold } from "../driver.ts";

const placed = (id: string): PlacedDistrict => ({ id, gold: 0 });

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

const annScore = (state: CitadelsState): number =>
  scoreGame(state).find((score) => score.seat === ANN)?.unique ?? 0;

test("the Imperial Treasury scores 1 point for each gold in the owner's stash", () => {
  const city = [placed("watchtower"), placed("imperial-treasury")];
  const state = withGold(withCity(rawGenesis(SEATS3), ANN, city), ANN, 7);
  expect(imperialTreasuryScoring(placed("imperial-treasury"), city, ANN, state)).toBe(7);
});

test("a stash of zero gold scores no Imperial Treasury points", () => {
  const city = [placed("imperial-treasury")];
  const state = withGold(withCity(rawGenesis(SEATS3), ANN, city), ANN, 0);
  expect(imperialTreasuryScoring(placed("imperial-treasury"), city, ANN, state)).toBe(0);
});

test("the points track the owner's gold and no other seat's", () => {
  const city = [placed("imperial-treasury")];
  const richBob = withGold(withGold(withCity(rawGenesis(SEATS3), ANN, city), ANN, 4), BOB, 9);
  expect(imperialTreasuryScoring(placed("imperial-treasury"), city, ANN, richBob)).toBe(4);
});

test("the exact extra points reach the score through the engine's scoring pass", () => {
  const city = [placed("watchtower"), placed("imperial-treasury")];
  const state = withGold(withCity(rawGenesis(SEATS3), ANN, city), ANN, 7);
  const ann = scoreGame(state).find((score) => score.seat === ANN);
  // District costs: 1 + 5 = 6; no five-colour bonus; 7 Imperial Treasury points.
  expect(ann?.districts).toBe(6);
  expect(ann?.unique).toBe(7);
  expect(ann?.total).toBe(13);
});

test("the ability is not a no-op: more gold credits strictly more points", () => {
  const city = [placed("imperial-treasury")];
  const genesis = rawGenesis(SEATS3);
  const broke = annScore(withGold(withCity(genesis, ANN, city), ANN, 0));
  const rich = annScore(withGold(withCity(genesis, ANN, city), ANN, 5));
  expect(broke).toBe(0);
  expect(rich).toBe(5);
  expect(rich).toBeGreaterThan(broke);
});
