import { expect, test } from "vitest";
import { act, idle, type SeatId } from "../../../../index.ts";
import { abbot, abbotResolve } from "../../../../lockstep/games/citadels/characters/abbot.ts";
import type { CitadelsAction, CitadelsState, Window } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  BOB,
  CARA,
  SEATS3,
  rawFrame,
  rawGenesis,
  rawGold,
  rawHand,
  rawRandom,
  withGold,
} from "../driver.ts";

const ABBOT_CAST = BASE_CAST_IDS;

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

const abbotState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, ABBOT_CAST),
  claimed: [{ seat: ANN, character: "abbot" }],
});

const ctxFor = (state: CitadelsState) => ({ state, seat: ANN, rest: [], rng: rawRandom() });

const openWindow = (state: CitadelsState): Window => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no open window");
  return top.window;
};

const resolve = (state: CitadelsState, action: CitadelsAction | null): CitadelsState =>
  abbotResolve({
    state,
    window: openWindow(state),
    frame: rawFrame(0, [[ANN, action === null ? idle<CitadelsAction>() : act(action)]]),
    rng: rawRandom(),
  });

/** The split window opened by the Abbot's own effect. */
const opened = (state: CitadelsState): CitadelsState => {
  const next = abbot(ctxFor(state));
  expect(next.steps[0]).toMatchObject({ kind: "window", window: { purpose: "abbot-split" } });
  return next;
};

test("gain either 1 gold or 1 card per religious district in your city", () => {
  const state = withCity(abbotState(), ANN, ["temple", "church", "monastery"]);
  const gold = resolve(opened(state), { t: "pay", amount: 3 });
  expect(rawGold(gold, ANN)).toBe(rawGold(state, ANN) + 3);
  expect(rawHand(gold, ANN)).toHaveLength(rawHand(state, ANN).length);
  const cards = resolve(opened(state), { t: "pay", amount: 0 });
  expect(rawGold(cards, ANN)).toBe(rawGold(state, ANN));
  expect(rawHand(cards, ANN)).toHaveLength(rawHand(state, ANN).length + 3);
});

test("the split is any combination you declare before taking", () => {
  const state = withCity(abbotState(), ANN, ["temple", "church", "monastery"]);
  const mixed = resolve(opened(state), { t: "pay", amount: 2 });
  expect(rawGold(mixed, ANN)).toBe(rawGold(state, ANN) + 2);
  expect(rawHand(mixed, ANN)).toHaveLength(rawHand(state, ANN).length + 1);
});

test("if you are not the richest player, the richest player must give you 1 gold", () => {
  const state = withGold(abbotState(), BOB, 5);
  const next = resolve(opened(state), { t: "pay", amount: 0 });
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 1);
  expect(rawGold(next, BOB)).toBe(5 - 1);
});

test("on a tie you choose which tied player pays", () => {
  const tied = withGold(withGold(abbotState(), BOB, 5), CARA, 5);
  const chosen = resolve(resolve(opened(tied), { t: "pay", amount: 0 }), { t: "target", seat: CARA });
  expect(rawGold(chosen, CARA)).toBe(5 - 1);
  expect(rawGold(chosen, BOB)).toBe(5);
  expect(rawGold(chosen, ANN)).toBe(rawGold(tied, ANN) + 1);
});

test("if you are among the tied you receive nothing", () => {
  const tied = withGold(withGold(abbotState(), ANN, 5), BOB, 5);
  const next = resolve(opened(tied), { t: "pay", amount: 0 });
  expect(rawGold(next, ANN)).toBe(5);
  expect(rawGold(next, BOB)).toBe(5);
  expect(next.steps).toHaveLength(0);
});

test("the ability is not a no-op: it opens the split window and moves gold", () => {
  const state = withGold(withCity(abbotState(), ANN, ["temple", "church"]), BOB, 4);
  const next = resolve(opened(state), { t: "pay", amount: 0 });
  expect(rawGold(next, ANN)).toBeGreaterThan(rawGold(state, ANN));
  expect(rawGold(next, BOB)).toBeLessThan(rawGold(state, BOB));
});
