import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import { mapRoomScoring } from "../../../../lockstep/games/citadels/districts/map-room.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import { ANN, BOB, SEATS3, rawGenesis, withHand } from "../driver.ts";

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

test("the Map Room scores 1 point for each card in the owner's hand", () => {
  const city = [placed("watchtower"), placed("map-room")];
  const state = withHand(withCity(rawGenesis(SEATS3), ANN, city), ANN, [
    "tavern",
    "market",
    "docks",
  ]);
  expect(mapRoomScoring(placed("map-room"), city, ANN, state)).toBe(3);
});

test("an empty hand scores no Map Room points", () => {
  const city = [placed("map-room")];
  const state = withHand(withCity(rawGenesis(SEATS3), ANN, city), ANN, []);
  expect(mapRoomScoring(placed("map-room"), city, ANN, state)).toBe(0);
});

test("the points count the owner's hand and no other seat's", () => {
  const city = [placed("map-room")];
  const state = withHand(
    withHand(withCity(rawGenesis(SEATS3), ANN, city), ANN, ["tavern"]),
    BOB,
    ["manor", "castle", "palace", "fortress"],
  );
  expect(mapRoomScoring(placed("map-room"), city, ANN, state)).toBe(1);
});

test("the exact extra points reach the score through the engine's scoring pass", () => {
  const city = [placed("watchtower"), placed("map-room")];
  const state = withHand(withCity(rawGenesis(SEATS3), ANN, city), ANN, [
    "tavern",
    "market",
    "docks",
  ]);
  const ann = scoreGame(state).find((score) => score.seat === ANN);
  // District costs: 1 + 5 = 6; no five-colour bonus; 3 Map Room points.
  expect(ann?.districts).toBe(6);
  expect(ann?.unique).toBe(3);
  expect(ann?.total).toBe(9);
});

test("the ability is not a no-op: more cards in hand credit strictly more points", () => {
  const city = [placed("map-room")];
  const genesis = rawGenesis(SEATS3);
  const empty = annScore(withHand(withCity(genesis, ANN, city), ANN, []));
  const stocked = annScore(
    withHand(withCity(genesis, ANN, city), ANN, ["tavern", "market", "docks"]),
  );
  expect(empty).toBe(0);
  expect(stocked).toBe(3);
  expect(stocked).toBeGreaterThan(empty);
});
