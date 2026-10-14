import { expect, test } from "vitest";
import { exchangeCost } from "../../../../lockstep/games/citadels/characters/diplomat.ts";
import { destroyPrice } from "../../../../lockstep/games/citadels/characters/warlord.ts";
import {
  greatWall,
  greatWallExchangeToll,
  greatWallScoring,
  greatWallToll,
  greatWallTriggers,
} from "../../../../lockstep/games/citadels/districts/great-wall.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import type { PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import { ANN, SEATS3, rawGenesis, rawPlayer, rawRandom } from "../driver.ts";

const cityOf = (ids: readonly string[]): readonly PlacedDistrict[] =>
  ids.map((id) => ({ id, gold: 0 }));

const walled = cityOf(["great-wall", "palace"]);
const plain = cityOf(["palace", "tavern"]);

test("the Warlord pays one extra gold to destroy a district in a city holding the Great Wall", () => {
  // Palace costs 5; the Warlord pays one less (4), the Great Wall adds one back (5).
  expect(destroyPrice("palace") + greatWallToll(walled)).toBe(5);
  expect(destroyPrice("palace") + greatWallToll(plain)).toBe(4);
});

test("the Diplomat pays one extra gold to exchange a district out of a city holding the Great Wall", () => {
  // Palace (5) taken for Tavern (1): the base difference is 4, the wall adds 1.
  const base = exchangeCost("palace", "tavern");
  expect(base + greatWallExchangeToll(walled, plain)).toBe(5);
  expect(base + greatWallExchangeToll(plain, plain)).toBe(4);
});

test("the Diplomat does not apply the Great Wall's effect to the district he gives from his own city", () => {
  // The Diplomat's own city holds a Great Wall; the district he gives (tavern) is not tolled.
  const mineWalled = cityOf(["great-wall", "tavern"]);
  expect(greatWallExchangeToll(plain, mineWalled)).toBe(0);
  // Contrast: tolling the taken city still fires when the rival holds the wall.
  expect(greatWallExchangeToll(mineWalled, plain)).toBe(1);
});

test("the toll is not a no-op: it is zero without the wall and one with it", () => {
  expect(greatWallToll(plain)).toBe(0);
  expect(greatWallToll(walled)).toBe(1);
  expect(greatWallToll([])).toBe(0);
});

test("the Great Wall declares the onDestroy hook the engine consults before a destroy", () => {
  expect(greatWallTriggers).toEqual(["onDestroy"]);
});

test("the Great Wall mutates no state: its effect is the toll, not a rewrite", () => {
  const state = rawGenesis(SEATS3);
  const ctx = {
    state,
    owner: ANN,
    city: rawPlayer(state, ANN).city,
    rest: [],
    rng: rawRandom(),
  };
  expect(greatWall(ctx)).toEqual(state);
});

test("the Great Wall scores no extra points of its own on a crafted city", () => {
  const city = cityOf(["great-wall", "palace"]);
  const placed = city[0];
  if (placed === undefined) throw new Error("no great-wall placed");
  expect(greatWallScoring(placed, city, ANN)).toBe(0);
  expect(specOfDistrict("great-wall").cost).toBe(6);
});
