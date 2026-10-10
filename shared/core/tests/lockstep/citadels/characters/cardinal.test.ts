import { expect, test } from "vitest";
import { act, idle, type SeatId } from "../../../../index.ts";
import {
  cardinal,
  cardinalResolve,
  cardinalShortfall,
  coverShortfall,
} from "../../../../lockstep/games/citadels/characters/cardinal.ts";
import type { CitadelsAction, CitadelsState, Window } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  BOB,
  SEATS3,
  rawFrame,
  rawGenesis,
  rawGold,
  rawHand,
  rawRandom,
  withGold,
  withHand,
} from "../driver.ts";

const CARDINAL_CAST = BASE_CAST_IDS;

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

const cardinalState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, CARDINAL_CAST),
  claimed: [{ seat: ANN, character: "cardinal" }],
});

const ctxFor = (state: CitadelsState) => ({ state, seat: ANN, rest: [], rng: rawRandom() });

const openWindow = (state: CitadelsState): Window => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no open window");
  return top.window;
};

const resolve = (state: CitadelsState, action: CitadelsAction | null): CitadelsState =>
  cardinalResolve({
    state,
    window: openWindow(state),
    frame: rawFrame(0, [[ANN, action === null ? idle<CitadelsAction>() : act(action)]]),
    rng: rawRandom(),
  });

/** Arm the open cardinal-gold window with the shortfall to cover. */
const withShortfall = (state: CitadelsState, amount: number): CitadelsState =>
  state.pending === null ? state : { ...state, pending: { ...state.pending, amount } };

test("gain 1 CARD per religious district in your city", () => {
  const state = withCity(cardinalState(), ANN, ["temple", "church", "monastery", "tavern"]);
  const next = cardinal(ctxFor(state));
  expect(rawHand(next, ANN)).toHaveLength(rawHand(state, ANN).length + 3);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN));
});

test("when you build a district and lack the gold, you may take the shortfall from one player", () => {
  const base = withGold(withCity(cardinalState(), ANN, ["temple", "church"]), ANN, 1);
  expect(cardinalShortfall(base, ANN, 5)).toBe(4);
  const armed = withGold(withShortfall(cardinal(ctxFor(base)), 4), BOB, 10);
  const next = resolve(armed, { t: "target", seat: BOB });
  expect(rawGold(next, ANN)).toBe(1 + 4);
  expect(rawGold(next, BOB)).toBe(10 - 4);
});

test("giving that player one card from your hand per gold taken", () => {
  const base = withGold(withCity(cardinalState(), ANN, ["temple", "church"]), ANN, 1);
  const drawn = cardinal(ctxFor(base));
  const armed = withGold(withHand(withShortfall(drawn, 3), ANN, ["tavern", "market", "docks", "harbor"]), BOB, 10);
  const next = resolve(armed, { t: "target", seat: BOB });
  expect(rawHand(next, ANN)).toEqual(["harbor"]);
  expect(rawHand(next, BOB)).toEqual([...rawHand(drawn, BOB), "tavern", "market", "docks"]);
});

test("the player cannot refuse and you cannot take more than needed", () => {
  const base = withGold(withCity(cardinalState(), ANN, ["temple"]), ANN, 2);
  const armed = withGold(withShortfall(cardinal(ctxFor(base)), 1), BOB, 9);
  const next = resolve(armed, { t: "target", seat: BOB });
  expect(rawGold(next, ANN)).toBe(3);
  expect(rawGold(next, BOB)).toBe(9 - 1);
  // The donor has no report; naming them settles the transfer unconditionally.
  expect(next.steps).toHaveLength(0);
});

test("you cannot take more gold than the donor holds", () => {
  const base = withGold(withCity(cardinalState(), ANN, ["temple"]), ANN, 0);
  const armed = withGold(withShortfall(cardinal(ctxFor(base)), 4), BOB, 1);
  const next = resolve(armed, { t: "target", seat: BOB });
  expect(rawGold(next, ANN)).toBe(1);
  expect(rawGold(next, BOB)).toBe(0);
});

test("the ability is not a no-op: it draws cards and moves gold from a donor", () => {
  const base = withGold(withCity(cardinalState(), ANN, ["temple", "church"]), ANN, 1);
  const next = cardinal(ctxFor(base));
  expect(rawHand(next, ANN)).toHaveLength(rawHand(base, ANN).length + 2);
  const paid = resolve(withGold(withShortfall(next, 2), BOB, 8), { t: "target", seat: BOB });
  expect(rawGold(paid, ANN)).toBeGreaterThan(rawGold(base, ANN));
  expect(rawGold(paid, BOB)).toBeLessThan(8);
});

test("coverShortfall never touches a self-donor", () => {
  const state = withCity(cardinalState(), ANN, ["temple"]);
  const next = coverShortfall(state, ANN, ANN, 3);
  expect(next).toEqual(state);
});
