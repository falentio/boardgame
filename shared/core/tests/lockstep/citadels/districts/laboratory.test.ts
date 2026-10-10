import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import {
  laboratory,
  laboratoryScoring,
  laboratoryTriggers,
} from "../../../../lockstep/games/citadels/districts/laboratory.ts";
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

test("discard one card from your hand", () => {
  const state = withHand(turnState(["laboratory"]), ANN, ["watchtower", "tavern", "manor"]);
  const next = laboratory(ctxFor(state));
  expect(rawHand(next, ANN)).toEqual(["tavern", "manor"]);
});

test("take 2 gold", () => {
  const state = withGold(withHand(turnState(["laboratory"]), ANN, ["watchtower"]), ANN, 3);
  const next = laboratory(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(5);
});

test("the discarded card leaves the hand for the discard pile, conserving the deck", () => {
  const state = withHand(turnState(["laboratory"]), ANN, ["watchtower", "tavern"]);
  const next = laboratory(ctxFor(state));
  expect(next.discard).toEqual(["watchtower"]);
  expect(rawHand(next, ANN)).toEqual(["tavern"]);
});

test("with an empty hand there is no card to discard and no gold is taken", () => {
  const state = withGold(withHand(turnState(["laboratory"]), ANN, []), ANN, 3);
  const next = laboratory(ctxFor(state));
  expect(next).toBe(state);
  expect(rawGold(next, ANN)).toBe(3);
});

test("the engine fires the ability at most once per turn", () => {
  const armed = withGold(
    withHand(turnState(["laboratory"]), ANN, ["watchtower", "tavern", "manor", "castle"]),
    ANN,
    0,
  );
  const next = advance(armed, () => ({ t: "gold" }));
  // One gather turn: 2 gold income plus one Laboratory payout, one card discarded.
  expect(rawGold(next, ANN)).toBe(4);
  expect(rawHand(next, ANN)).toHaveLength(3);
  expect(next.discard).toEqual(["watchtower"]);
});

test("the Laboratory declares the onEndTurn trigger", () => {
  expect(laboratoryTriggers).toEqual(["onEndTurn"]);
});

test("the Laboratory scores no extra points on a crafted city", () => {
  const city = [
    { id: "laboratory", gold: 0 },
    { id: "watchtower", gold: 0 },
  ];
  expect(laboratoryScoring(city[0]!, city, ANN)).toBe(0);
  const state = withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    ["laboratory", "watchtower"],
  );
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 5 + 1; the Laboratory adds nothing at end of game.
  expect(score?.districts).toBe(6);
  expect(score?.unique).toBe(0);
});

test("the effect is not a no-op: it moves one card out of hand and pays 2 gold", () => {
  const state = withGold(withHand(turnState(["laboratory"]), ANN, ["watchtower"]), ANN, 1);
  const next = laboratory(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 2);
  expect(rawHand(next, ANN)).toHaveLength(rawHand(state, ANN).length - 1);
  expect(rawPlayer(next, ANN).city).toEqual(rawPlayer(state, ANN).city);
});
