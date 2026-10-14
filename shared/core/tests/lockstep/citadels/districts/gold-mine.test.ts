import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import {
  goldMine,
  goldMineScoring,
  goldMineTriggers,
} from "../../../../lockstep/games/citadels/districts/gold-mine.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  advance,
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

const ctxFor = (state: CitadelsState) => ({ state, owner: ANN, city: [], rest: [], rng: rawRandom() });

test("take 1 extra gold when you choose gold while gathering resources", () => {
  const state = withCity(turnState([]), ANN, ["gold-mine"]);
  const next = goldMine(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 1);
});

test("the extra gold lands on the gold gather end to end: 2 base plus 1 extra", () => {
  const state = withGold(turnState(["gold-mine"]), ANN, 4);
  const next = advance(state, () => ({ t: "gold" }));
  expect(rawGold(next, ANN)).toBe(7);
});

test("the trigger never fires on a card draw: choosing cards takes no extra gold", () => {
  const state = withGold(turnState(["gold-mine"]), ANN, 4);
  const next = advance(state, () => ({ t: "draw" }));
  expect(rawGold(next, ANN)).toBe(4);
});

test("the Gold Mine declares the onIncome trigger", () => {
  expect(goldMineTriggers).toEqual(["onIncome"]);
});

test("the Gold Mine scores no extra points on a crafted city", () => {
  const city = [
    { id: "gold-mine", gold: 0 },
    { id: "watchtower", gold: 0 },
  ];
  expect(goldMineScoring(city[0]!, city, ANN, rawGenesis(SEATS3))).toBe(0);
  const state = withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    ["gold-mine", "watchtower"],
  );
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 6 + 1; the Gold Mine adds nothing at end of game.
  expect(score?.districts).toBe(7);
  expect(score?.unique).toBe(0);
});

test("the effect is not a no-op: a gold gather pays exactly one more than the base", () => {
  const withMine = withGold(turnState(["gold-mine"]), ANN, 4);
  const without = withGold(turnState([]), ANN, 4);
  const paidWith = rawGold(advance(withMine, () => ({ t: "gold" })), ANN);
  const paidWithout = rawGold(advance(without, () => ({ t: "gold" })), ANN);
  expect(paidWith - paidWithout).toBe(1);
});
