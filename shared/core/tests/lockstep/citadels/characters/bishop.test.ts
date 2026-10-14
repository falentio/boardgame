import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import { bishop, bishopShield } from "../../../../lockstep/games/citadels/characters/bishop.ts";
import type { CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import { ANN, BASE_CAST_IDS, BOB, CARA, SEATS3, rawGenesis, rawGold, rawRandom } from "../driver.ts";

const BISHOP_CAST = BASE_CAST_IDS;

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

const bishopState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, BISHOP_CAST),
  claimed: [{ seat: ANN, character: "bishop" }],
});

const ctxFor = (state: CitadelsState) => ({ state, seat: ANN, rest: [], rng: rawRandom() });

test("gain 1 gold per religious district in your city", () => {
  const state = withCity(bishopState(), ANN, ["temple", "church", "monastery", "tavern"]);
  const next = bishop(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 3);
});

test("during this round the rank 8 character cannot use its ability on your districts", () => {
  const state = bishopState();
  expect(bishopShield(state)).toBe(ANN);
});

test("if killed, rank 8 may target you", () => {
  const state: CitadelsState = { ...bishopState(), skipped: ["bishop"] };
  expect(bishopShield(state)).toBeNull();
});

test("if bewitched, rank 8 cannot target the Witch's districts but can target the Bishop's", () => {
  const claimed = [
    { seat: ANN, character: "bishop" },
    { seat: BOB, character: "witch" },
  ];
  const state: CitadelsState = { ...bishopState(), claimed, bewitched: "bishop" };
  // The shield names the Witch's seat, so it leaves the Bishop's own districts open.
  expect(bishopShield(state)).toBe(BOB);
});

test("the ability is not a no-op: it raises the Bishop's gold", () => {
  const state = withCity(bishopState(), ANN, ["temple", "church"]);
  const next = bishop(ctxFor(state));
  expect(rawGold(next, ANN)).toBeGreaterThan(rawGold(state, ANN));
});

test("a killed Bishop shields no one and collects no income", () => {
  const state: CitadelsState = { ...withCity(bishopState(), ANN, ["temple", "church"]), skipped: ["bishop"] };
  expect(bishopShield(state)).toBeNull();
  expect(rawGold(bishop(ctxFor(state)), ANN)).toBe(rawGold(state, ANN));
});

test("a Bishop with no religious districts gains no gold", () => {
  const state = withCity(bishopState(), ANN, ["manor", "tavern", "watchtower"]);
  const next = bishop(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN));
  expect(next.players.find((p) => p.seat === CARA)?.gold).toBe(rawGold(state, CARA));
});
