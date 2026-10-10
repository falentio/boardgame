import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { armoryResolve } from "../../../lockstep/games/citadels/districts/armory.ts";
import { theaterResolve } from "../../../lockstep/games/citadels/districts/theater.ts";
import { DISTRICT_RESOLVERS } from "../../../lockstep/games/citadels/districts/effects.ts";
import { type DistrictId } from "../../../lockstep/games/citadels/districts.ts";
import { citadels } from "../../../lockstep/games/citadels/index.ts";
import { type CitadelsState } from "../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  SEATS4,
  advance,
  autoAction,
  openPurpose,
  rawGenesis,
} from "./driver.ts";

const WINDOW_SOURCE = fileURLToPath(
  new URL("../../../lockstep/games/citadels/windows.ts", import.meta.url),
);

/** The default 14 uniques with Theater swapped in, so both district windows are in play. */
const ARMORY_AND_THEATER: readonly DistrictId[] = [
  "keep",
  "laboratory",
  "smithy",
  "library",
  "school-of-magic",
  "dragon-gate",
  "observatory",
  "great-wall",
  "factory",
  "museum",
  "park",
  "armory",
  "capitol",
  "theater",
];

/** A turn-phase state with a district-owned window on top and a round close below it. */
const withWindow = (
  state: CitadelsState,
  purpose: "armory-destroy" | "theatre-swap",
): CitadelsState => ({
  ...state,
  phase: "turn",
  draft: null,
  steps: [
    { kind: "window", window: { kind: "oneOf", purpose, seats: [ANN] } },
    { kind: "end-round" },
  ],
});

const playToTerminal = (state: CitadelsState): CitadelsState => {
  let next = state;
  let frames = 0;
  while (!citadels.isTerminal(next) && frames < 20_000) {
    next = advance(next, (seat, s) => autoAction(seat, citadels.project(s, seat)));
    frames += 1;
  }
  return next;
};

test("the district resolver registry names the Armory and Theater windows", () => {
  expect(DISTRICT_RESOLVERS["armory-destroy"]).toBeDefined();
  expect(DISTRICT_RESOLVERS["theatre-swap"]).toBeDefined();
  expect(DISTRICT_RESOLVERS["armory-destroy"]).toBe(armoryResolve);
  expect(DISTRICT_RESOLVERS["theatre-swap"]).toBe(theaterResolve);
});

test("stepState tries the district registry before the character registry", () => {
  const source = readFileSync(WINDOW_SOURCE, "utf8");
  const district = source.indexOf("DISTRICT_RESOLVERS[top.window.purpose]");
  const character = source.indexOf("CHARACTER_RESOLVERS[top.window.purpose]");
  expect(district).toBeGreaterThanOrEqual(0);
  expect(character).toBeGreaterThanOrEqual(0);
  expect(district).toBeLessThan(character);
});

test("an open armory-destroy window pops and the engine continues past it", () => {
  const armed = withWindow(
    rawGenesis(SEATS3, BASE_CAST_IDS, "citadels-raw-tests", ARMORY_AND_THEATER),
    "armory-destroy",
  );
  expect(openPurpose(armed)).toBe("armory-destroy");
  const next = advance(armed, () => null);
  expect(openPurpose(next)).not.toBe("armory-destroy");
});

test("an open theatre-swap window pops and the engine continues past it", () => {
  const armed = withWindow(
    rawGenesis(SEATS3, BASE_CAST_IDS, "citadels-raw-tests", ARMORY_AND_THEATER),
    "theatre-swap",
  );
  expect(openPurpose(armed)).toBe("theatre-swap");
  const next = advance(armed, () => null);
  expect(openPurpose(next)).not.toBe("theatre-swap");
});

test("a full game whose deck holds both Armory and Theater reaches terminal", () => {
  const state = playToTerminal(
    rawGenesis(SEATS4, BASE_CAST_IDS, "citadels-raw-tests", ARMORY_AND_THEATER),
  );
  expect(citadels.isTerminal(state)).toBe(true);
  expect(state.phase).toBe("over");
});

test("a game with Armory in a seat's city still reaches terminal", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "citadels-raw-tests", ARMORY_AND_THEATER);
  const holding: CitadelsState = {
    ...base,
    players: base.players.map((player) =>
      player.seat === ANN ? { ...player, city: [{ id: "armory", gold: 0 }] } : player,
    ),
  };
  const state = playToTerminal(holding);
  expect(citadels.isTerminal(state)).toBe(true);
  expect(state.phase).toBe("over");
});
