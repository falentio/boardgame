import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import {
  theaterResolve,
  theaterScoring,
  theaterTriggers,
} from "../../../../lockstep/games/citadels/districts/theater.ts";
import { UNIQUE_SCORING } from "../../../../lockstep/games/citadels/districts/effects.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import { ANN, BASE_CAST_IDS, SEATS3, rawGenesis, rawRandom } from "../driver.ts";

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

/**
 * A city that reaches every scoring term: the Theater (unique), one district of
 * each of the other four types, and a first-completed-city bonus.
 */
const scored = (): CitadelsState =>
  withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    ["theater", "manor", "temple", "tavern", "watchtower"],
  );

test("the Theater adds no end-game points of its own", () => {
  const city = [
    { id: "theater", gold: 0 },
    { id: "manor", gold: 0 },
  ];
  expect(theaterScoring(city[0]!, city, ANN)).toBe(0);
});

test("a crafted city scores exactly its cost sum, colour bonus, and completion bonus", () => {
  const score = scoreGame(scored()).find((entry) => entry.seat === ANN);
  // Costs: theater 3 + manor 3 + temple 1 + tavern 1 + watchtower 1 = 9.
  expect(score?.districts).toBe(9);
  // All five district types are present.
  expect(score?.colors).toBe(3);
  // First to complete.
  expect(score?.completion).toBe(4);
  // The Theater's swap ability earns no end-game points.
  expect(score?.unique).toBe(0);
  expect(score?.total).toBe(16);
});

test("the Theater's unique points are exactly zero; dropping it changes only cost and colour", () => {
  const state = scored();
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  const withoutTheater = withCity(state, ANN, ["manor", "temple", "tavern", "watchtower"]);
  const bare = scoreGame(withoutTheater).find((entry) => entry.seat === ANN);
  // Removing the Theater costs its 3 gold of cost and the 3-point five-type
  // bonus (the unique type leaves), never any Theater-specific bonus.
  expect((score?.total ?? 0) - (bare?.total ?? 0)).toBe(6);
  expect(score?.unique).toBe(0);
  expect(bare?.unique).toBe(0);
});

test("the Theater registers its own scoring function and the onRoundStart trigger", () => {
  expect(UNIQUE_SCORING["theater"]).toBe(theaterScoring);
  expect(theaterTriggers).toEqual(["onRoundStart"]);
});

test("the Theater's scoring is not a no-op on the total: a spurious bonus would move it", () => {
  const score = scoreGame(scored()).find((entry) => entry.seat === ANN);
  // 9 + 3 + 4 = 16 with no unique points; any spurious Theater bonus breaks this.
  expect(score?.total).toBe(16);
});

test("the theatre-swap window resolver exists and pops the window", () => {
  const state: CitadelsState = {
    ...rawGenesis(SEATS3, BASE_CAST_IDS),
    steps: [
      { kind: "window", window: { kind: "oneOf", purpose: "theatre-swap", seats: [ANN] } },
      { kind: "end-round" },
    ],
  };
  const next = theaterResolve({
    state,
    window: { kind: "oneOf", purpose: "theatre-swap", seats: [ANN] },
    frame: { index: 0 as never, seed: "0000000000000000" as never, inputs: [] },
    rng: rawRandom(),
  });
  expect(next.steps[0]).toMatchObject({ kind: "end-round" });
});
