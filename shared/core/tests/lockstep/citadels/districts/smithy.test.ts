import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import {
  smithy,
  smithyScoring,
  smithyTriggers,
} from "../../../../lockstep/games/citadels/districts/smithy.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  rawGenesis,
  rawGold,
  rawHand,
  rawPlayer,
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

const ctxFor = (state: CitadelsState) => ({
  state,
  owner: ANN,
  city: [],
  rest: [],
  rng: rawRandom(),
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

test("draw 3 cards from the deck", () => {
  const state = withGold(withHand(turnState(["smithy"]), ANN, ["watchtower"]), ANN, 5);
  const next = smithy(ctxFor(state));
  expect(rawHand(next, ANN)).toHaveLength(4);
  expect(next.deck).toHaveLength(state.deck.length - 3);
});

test("pay 2 gold", () => {
  const state = withGold(withHand(turnState(["smithy"]), ANN, ["watchtower"]), ANN, 5);
  const next = smithy(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(3);
});

test("the three cards come off the top of the deck and the deck stays conserved", () => {
  const state = withGold(withHand(turnState(["smithy"]), ANN, ["watchtower"]), ANN, 5);
  const next = smithy(ctxFor(state));
  expect(rawHand(next, ANN).slice(1)).toEqual(state.deck.slice(0, 3));
  expect(totalCards(next)).toBe(totalCards(state));
});

test("with fewer than 2 gold you cannot pay and nothing is drawn", () => {
  const state = withGold(withHand(turnState(["smithy"]), ANN, ["watchtower"]), ANN, 1);
  const next = smithy(ctxFor(state));
  expect(next).toBe(state);
  expect(rawGold(next, ANN)).toBe(1);
  expect(rawHand(next, ANN)).toHaveLength(1);
});

test("the engine fires the ability at most once per turn", () => {
  const armed = withGold(withHand(turnState(["smithy"]), ANN, ["watchtower"]), ANN, 2);
  const next = advance(armed, () => ({ t: "gold" }));
  // One gather turn: 2 gold income, then the Smithy pays 2 and draws 3.
  expect(rawGold(next, ANN)).toBe(2);
  expect(rawHand(next, ANN)).toHaveLength(4);
  expect(next.deck).toHaveLength(armed.deck.length - 3);
});

test("the Smithy declares the onEndTurn trigger", () => {
  expect(smithyTriggers).toEqual(["onEndTurn"]);
});

test("the Smithy scores no extra points on a crafted city", () => {
  const city = [
    { id: "smithy", gold: 0 },
    { id: "watchtower", gold: 0 },
  ];
  expect(smithyScoring(city[0]!, city, ANN)).toBe(0);
  const state = withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    ["smithy", "watchtower"],
  );
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 5 + 1; the Smithy adds nothing at end of game.
  expect(score?.districts).toBe(6);
  expect(score?.unique).toBe(0);
});

test("the effect is not a no-op: it pays 2 gold and grows the hand by 3", () => {
  const state = withGold(withHand(turnState(["smithy"]), ANN, ["watchtower"]), ANN, 5);
  const next = smithy(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) - 2);
  expect(rawHand(next, ANN)).toHaveLength(rawHand(state, ANN).length + 3);
  expect(rawPlayer(next, ANN).city).toEqual(rawPlayer(state, ANN).city);
});
