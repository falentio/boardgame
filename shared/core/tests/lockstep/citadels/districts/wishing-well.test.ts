import { expect, test } from "vitest";
import { type SeatId } from "../../../../index.ts";
import { wishingWellScoring } from "../../../../lockstep/games/citadels/districts/wishing-well.ts";
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

test("the Wishing Well scores 1 for each unique district in the city, itself included", () => {
  const city = [placed("watchtower"), placed("wishing-well"), placed("park")];
  expect(wishingWellScoring(placed("wishing-well"), city, ANN)).toBe(2);
});

test("basic districts never add Wishing Well points", () => {
  const city = [placed("watchtower"), placed("prison"), placed("wishing-well")];
  expect(wishingWellScoring(placed("wishing-well"), city, ANN)).toBe(1);
});

test("the exact extra points reach the score through the engine's scoring pass", () => {
  // A city of basics plus the Wishing Well: its 1 unique is worth exactly 1 point.
  const state = withCity(rawGenesis(SEATS3), ANN, [
    placed("watchtower"),
    placed("prison"),
    placed("wishing-well"),
  ]);
  const ann = scoreGame(state).find((score) => score.seat === ANN);
  // District costs: 1 + 2 + 3 = 6; 1 Wishing Well point; no five-colour bonus.
  expect(ann?.unique).toBe(1);
  expect(ann?.districts).toBe(6);
  expect(ann?.total).toBe(7);
});

test("the ability is not a no-op: adding a unique raises the Wishing Well's points", () => {
  const fewer = [placed("wishing-well")];
  const more = [placed("wishing-well"), placed("park")];
  expect(wishingWellScoring(placed("wishing-well"), more, ANN)).toBeGreaterThan(
    wishingWellScoring(placed("wishing-well"), fewer, ANN),
  );
});
