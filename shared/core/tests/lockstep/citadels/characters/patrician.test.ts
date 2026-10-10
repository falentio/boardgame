import { expect, test } from "vitest";
import { patrician } from "../../../../lockstep/games/citadels/characters/patrician.ts";
import type { CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import type { SeatId } from "../../../../index.ts";
import { ANN, BASE_CAST_IDS, BOB, SEATS3, rawGenesis, rawHand, rawRandom } from "../driver.ts";

const PATRICIAN_CAST = BASE_CAST_IDS;

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

const patricianState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, PATRICIAN_CAST),
  claimed: [{ seat: ANN, character: "patrician" }],
  crown: BOB,
});

const ctxFor = (state: CitadelsState) => ({ state, seat: ANN, rest: [], rng: rawRandom() });

test("gain 1 card per noble district in your city", () => {
  const state = withCity(patricianState(), ANN, ["manor", "castle", "palace", "tavern"]);
  const next = patrician(ctxFor(state));
  expect(rawHand(next, ANN)).toHaveLength(rawHand(state, ANN).length + 3);
  expect(next.deck).toHaveLength(state.deck.length - 3);
});

test("at some point during your turn you must take the crown", () => {
  const state = { ...patricianState(), crown: BOB };
  const next = patrician(ctxFor(state));
  expect(next.crown).toBe(ANN);
});

test("if killed, at end of round reveal the Patrician and take the crown as heir", () => {
  const state = { ...withCity(patricianState(), ANN, ["manor", "castle"]), skipped: ["patrician"] };
  const next = patrician(ctxFor(state));
  expect(next.crown).toBe(ANN);
  expect(rawHand(next, ANN)).toHaveLength(rawHand(state, ANN).length);
});

test("if bewitched, you still take the crown", () => {
  const state = { ...patricianState(), bewitched: "patrician" };
  const next = patrician(ctxFor(state));
  expect(next.crown).toBe(ANN);
});

test("the ability is not a no-op: it draws cards and moves the crown", () => {
  const state = { ...withCity(patricianState(), ANN, ["manor", "castle"]), crown: BOB };
  const next = patrician(ctxFor(state));
  expect(next.crown).not.toBe(state.crown);
  expect(rawHand(next, ANN).length).toBeGreaterThan(rawHand(state, ANN).length);
});
