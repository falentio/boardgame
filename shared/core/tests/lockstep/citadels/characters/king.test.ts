import { expect, test } from "vitest";
import { king } from "../../../../lockstep/games/citadels/characters/king.ts";
import type { CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import type { SeatId } from "../../../../index.ts";
import { ANN, BASE_CAST_IDS, BOB, SEATS3, rawGenesis, rawGold, rawRandom } from "../driver.ts";

const KING_CAST = BASE_CAST_IDS;

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

const kingState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, KING_CAST),
  claimed: [{ seat: ANN, character: "king" }],
});

const ctxFor = (state: CitadelsState) => ({ state, seat: ANN, rest: [], rng: rawRandom() });

test("gain 1 gold per noble district in your city", () => {
  const state = withCity(kingState(), ANN, ["manor", "castle", "palace", "tavern"]);
  const next = king(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 3);
});

test("at some point during your turn you must take the crown", () => {
  const state = { ...kingState(), crown: BOB };
  const next = king(ctxFor(state));
  expect(next.crown).toBe(ANN);
});

test("if killed, at end of round reveal the King and take the crown as heir", () => {
  const state = { ...withCity(kingState(), ANN, ["manor", "castle"]), crown: BOB, skipped: ["king"] };
  const next = king(ctxFor(state));
  expect(next.crown).toBe(ANN);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN));
});

test("if bewitched, you still take the crown", () => {
  const state = { ...kingState(), crown: BOB, bewitched: "king" };
  const next = king(ctxFor(state));
  expect(next.crown).toBe(ANN);
});

test("the ability is not a no-op: it raises gold and moves the crown", () => {
  const state = { ...withCity(kingState(), ANN, ["manor", "castle"]), crown: BOB };
  const next = king(ctxFor(state));
  expect(next.crown).not.toBe(state.crown);
  expect(rawGold(next, ANN)).toBeGreaterThan(rawGold(state, ANN));
});
