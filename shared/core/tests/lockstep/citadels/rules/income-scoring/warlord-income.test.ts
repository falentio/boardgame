import { expect, test } from "vitest";
import type { SeatId } from "../../../../../index.ts";
import { warlord } from "../../../../../lockstep/games/citadels/characters/warlord.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../../lockstep/games/citadels/index.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  rawGenesis,
  rawGold,
  rawRandom,
} from "../../driver.ts";

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

const warlordState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, BASE_CAST_IDS, "fix-warlord"),
  claimed: [{ seat: ANN, character: "warlord" }],
});

const openWarlord = (state: CitadelsState): CitadelsState =>
  warlord({ state, seat: ANN, rest: [], rng: rawRandom() });

test("the Warlord's income counts a district that declares the military type", () => {
  const state = withCity(warlordState(), ANN, [
    { id: "watchtower", gold: 0 },
    { id: "school-of-magic", gold: 0, declaredType: "military" },
  ]);
  const next = openWarlord(state);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 2);
});

test("a declared-military district is the Warlord's only military income", () => {
  const state = withCity(warlordState(), ANN, [
    { id: "school-of-magic", gold: 0, declaredType: "military" },
    { id: "tavern", gold: 0 },
  ]);
  const next = openWarlord(state);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 1);
});
