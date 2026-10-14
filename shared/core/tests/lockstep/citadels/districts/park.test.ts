import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import {
  park,
  parkScoring,
  parkTriggers,
} from "../../../../lockstep/games/citadels/districts/park.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  rawGenesis,
  rawHand,
  rawRandom,
  totalCards,
  withGold,
  withHand,
} from "../driver.ts";

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

/** A turn phase with ANN's turn window open and a round close beneath it. */
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
 * Drive one turn to its close under the corrected turn model (commit 64420ca: a
 * turn gathers, then optionally builds). The gather window lands +2 and leaves a
 * build-capable turn window below it; answering that window ends the turn, where
 * the Park's onEndTurn hook fires.
 */
const playTurn = (state: CitadelsState): CitadelsState => {
  const gathered = advance(state, () => ({ t: "gold" }));
  return advance(gathered, () => ({ t: "gold" }));
};

const ctxFor = (state: CitadelsState) => ({ state, owner: ANN, city: [], rest: [], rng: rawRandom() });

test("draw two cards at end of turn when you hold no cards", () => {
  const state = withHand(turnState(["park"]), ANN, []);
  const next = playTurn(state);
  expect(rawHand(next, ANN)).toHaveLength(2);
});

test("draw exactly two, taken from the top of the deck", () => {
  const state = withHand(turnState(["park"]), ANN, []);
  const expected = state.deck.slice(0, 2);
  const next = playTurn(state);
  expect(rawHand(next, ANN)).toEqual(expected);
  expect(next.deck.length).toBe(state.deck.length - 2);
});

test("do not draw when a card remains in hand at end of turn", () => {
  const state = withHand(turnState(["park"]), ANN, ["tavern"]);
  const next = playTurn(state);
  expect(rawHand(next, ANN)).toEqual(["tavern"]);
});

test("the Park declares the onEndTurn trigger", () => {
  expect(parkTriggers).toEqual(["onEndTurn"]);
});

test("the Park scores no extra points on a crafted city", () => {
  const city = [
    { id: "park", gold: 0 },
    { id: "tavern", gold: 0 },
  ];
  expect(parkScoring(city[0]!, city, ANN, rawGenesis(SEATS3))).toBe(0);
  const state = withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    ["park", "tavern"],
  );
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 6 + 1; the Park adds nothing at end of game.
  expect(score?.districts).toBe(7);
  expect(score?.unique).toBe(0);
});

test("the effect is not a no-op: an empty hand gains two cards and conserves the deck", () => {
  const state = withGold(withHand(turnState(["park"]), ANN, []), ANN, 4);
  const next = playTurn(state);
  expect(rawHand(next, ANN).length).toBeGreaterThan(0);
  expect(totalCards(next)).toBe(totalCards(state));
});

test("the unit effect draws directly and does nothing when the hand is not empty", () => {
  const empty = withHand(turnState(["park"]), ANN, []);
  expect(rawHand(park(ctxFor(empty)), ANN)).toHaveLength(2);
  const held = withHand(turnState(["park"]), ANN, ["tavern"]);
  expect(park(ctxFor(held))).toBe(held);
});
