import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import {
  poorHouse,
  poorHouseScoring,
  poorHouseTriggers,
} from "../../../../lockstep/games/citadels/districts/poor-house.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawGold,
  rawRandom,
  withGold,
} from "../driver.ts";

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

/** A turn phase with ANN turn window open and a round close beneath it. */
const turnState = (city: readonly string[]): CitadelsState =>
  withCity(
    {
      ...rawGenesis(SEATS3, BASE_CAST_IDS),
      phase: "turn",
      draft: null,
      active: ANN,
      steps: [
        { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
        { kind: "end-round" },
      ],
    },
    ANN,
    city,
  );

/**
 * Play one turn to its close under the corrected turn model (commit 64420ca: a
 * turn gathers, then optionally builds). Gather with the action, resolve any keep
 * window it opened, then answer the build-capable turn window so the turn ends and
 * the Poor House's onEndTurn hook fires.
 */
const playTurn = (state: CitadelsState, action: "gold" | "draw"): CitadelsState => {
  const gathered = advance(state, () => ({ t: action }));
  const kept =
    openPurpose(gathered) === "keep"
      ? advance(gathered, () => ({ t: "keep", index: 0 }))
      : gathered;
  return advance(kept, () => ({ t: "gold" }));
};

const ctxFor = (state: CitadelsState) => ({ state, owner: ANN, city: [], rest: [], rng: rawRandom() });

test("take one gold at end of turn when you hold no gold", () => {
  const state = withGold(turnState(["poor-house"]), ANN, 0);
  const next = poorHouse(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(1);
});

test("the gold lands end to end when the turn leaves you broke", () => {
  // Drawing instead of taking gold keeps the stash at zero into the end-turn hook.
  const state = withGold(turnState(["poor-house"]), ANN, 0);
  const next = playTurn(state, "draw");
  expect(rawGold(next, ANN)).toBe(1);
});

test("take nothing when any gold remains at end of turn", () => {
  const state = withGold(turnState(["poor-house"]), ANN, 3);
  const next = poorHouse(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(3);
});

test("the Poor House declares the onEndTurn trigger", () => {
  expect(poorHouseTriggers).toEqual(["onEndTurn"]);
});

test("the Poor House scores no extra points on a crafted city", () => {
  const city = [
    { id: "poor-house", gold: 0 },
    { id: "tavern", gold: 0 },
  ];
  expect(poorHouseScoring(city[0]!, city, ANN, rawGenesis(SEATS3))).toBe(0);
  const state = withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    ["poor-house", "tavern"],
  );
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 4 + 1; the Poor House adds nothing at end of game.
  expect(score?.districts).toBe(5);
  expect(score?.unique).toBe(0);
});

test("the effect is not a no-op: a broke player ends the turn one gold richer", () => {
  const withHouse = withGold(turnState(["poor-house"]), ANN, 0);
  const without = withGold(turnState([]), ANN, 0);
  const paidWith = rawGold(playTurn(withHouse, "draw"), ANN);
  const paidWithout = rawGold(playTurn(without, "draw"), ANN);
  expect(paidWith - paidWithout).toBe(1);
});
