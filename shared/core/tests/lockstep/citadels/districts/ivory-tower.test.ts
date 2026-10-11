import { expect, test } from "vitest";
import { type SeatId } from "../../../../index.ts";
import { ivoryTowerScoring } from "../../../../lockstep/games/citadels/districts/ivory-tower.ts";
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

test("the Ivory Tower scores 5 when it is the only unique district in the city", () => {
  const city = [placed("watchtower"), placed("prison"), placed("ivory-tower")];
  expect(ivoryTowerScoring(placed("ivory-tower"), city, ANN)).toBe(5);
});

test("the Ivory Tower scores nothing when another unique district stands beside it", () => {
  const city = [placed("ivory-tower"), placed("park")];
  expect(ivoryTowerScoring(placed("ivory-tower"), city, ANN)).toBe(0);
});

test("an undeclared Haunted Quarter is still a unique and stops the Ivory Tower", () => {
  const city = [placed("ivory-tower"), placed("haunted-quarter")];
  expect(ivoryTowerScoring(placed("ivory-tower"), city, ANN)).toBe(0);
});

test("a Haunted Quarter counted as a non-unique type does not stop the Ivory Tower", () => {
  const city: readonly PlacedDistrict[] = [
    placed("ivory-tower"),
    { id: "haunted-quarter", gold: 0, declaredType: "noble" },
  ];
  expect(ivoryTowerScoring(placed("ivory-tower"), city, ANN)).toBe(5);
});

test("the exact extra points reach the score through the engine's scoring pass", () => {
  const state = withCity(rawGenesis(SEATS3), ANN, [
    placed("watchtower"),
    placed("prison"),
    placed("ivory-tower"),
  ]);
  const ann = scoreGame(state).find((score) => score.seat === ANN);
  // District costs: 1 + 2 + 5 = 8; 5 Ivory Tower points; no five-colour bonus.
  expect(ann?.unique).toBe(5);
  expect(ann?.districts).toBe(8);
  expect(ann?.total).toBe(13);
});

test("the ability is not a no-op: a lone unique scores 5 where a shared city scores 0", () => {
  const alone = [placed("ivory-tower")];
  const shared = [placed("ivory-tower"), placed("wishing-well")];
  expect(ivoryTowerScoring(placed("ivory-tower"), alone, ANN)).toBe(5);
  expect(ivoryTowerScoring(placed("ivory-tower"), shared, ANN)).toBe(0);
});
