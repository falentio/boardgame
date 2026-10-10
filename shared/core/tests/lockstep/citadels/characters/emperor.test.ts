import { expect, test } from "vitest";
import { act, idle, type SeatId } from "../../../../index.ts";
import { emperor, emperorResolve } from "../../../../lockstep/games/citadels/characters/emperor.ts";
import type { CitadelsAction, CitadelsState, Window } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  CARA,
  SEATS3,
  rawFrame,
  rawGenesis,
  rawGold,
  rawHand,
  rawRandom,
  withHand,
} from "../driver.ts";

const EMPEROR_CAST = [
  "assassin",
  "thief",
  "magician",
  "emperor",
  "bishop",
  "merchant",
  "architect",
  "warlord",
] as const;

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

/** The Emperor owns the rank-4 slot and a rival holds the crown. */
const emperorState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, EMPEROR_CAST),
  claimed: [{ seat: ANN, character: "emperor" }],
  crown: BOB,
});

const ctxFor = (state: CitadelsState) => ({ state, seat: ANN, rest: [], rng: rawRandom() });

const openWindow = (state: CitadelsState): Window => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no open window");
  return top.window;
};

const resolve = (state: CitadelsState, action: CitadelsAction | null): CitadelsState =>
  emperorResolve({
    state,
    window: openWindow(state),
    frame: rawFrame(0, [[ANN, action === null ? idle<CitadelsAction>() : act(action)]]),
    rng: rawRandom(),
  });

test("gain 1 gold per noble district in your city", () => {
  const state = withCity(emperorState(), ANN, ["manor", "castle", "palace", "tavern"]);
  const next = emperor(ctxFor(state));
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 3);
});

test("you must take the crown from its holder and give it to a different player, not yourself", () => {
  const opened = emperor(ctxFor(emperorState()));
  expect(opened.crown).toBe(ANN);
  const named = resolve(opened, { t: "target", seat: BOB });
  expect(named.crown).toBe(BOB);
  expect(named.crown).not.toBe(ANN);
  const selfish = resolve(opened, { t: "target", seat: ANN });
  expect(selfish.crown).not.toBe(ANN);
  expect([BOB, CARA]).toContain(selfish.crown);
});

test("then take either 1 gold or 1 random card from that player", () => {
  const opened = emperor(ctxFor(emperorState()));
  const named = resolve(opened, { t: "target", seat: BOB });
  const paid = resolve(named, { t: "gold" });
  expect(rawGold(paid, ANN)).toBe(rawGold(named, ANN) + 1);
  expect(rawGold(paid, BOB)).toBe(rawGold(named, BOB) - 1);
});

test("taking a card moves one random card from that player hand into yours", () => {
  const opened = emperor(ctxFor(emperorState()));
  const named = resolve(withHand(opened, BOB, ["manor"]), { t: "target", seat: BOB });
  const before = rawHand(named, ANN).length;
  const paid = resolve(named, { t: "draw" });
  expect(rawHand(paid, ANN)).toHaveLength(before + 1);
  expect(rawHand(paid, ANN)).toContain("manor");
  expect(rawHand(paid, BOB)).toHaveLength(0);
});

test("if killed, take the crown and pass it to a different player, taking nothing", () => {
  const state = { ...withCity(emperorState(), ANN, ["manor", "castle"]), skipped: ["emperor"] };
  const next = emperor(ctxFor(state));
  expect(next.crown).not.toBe(ANN);
  expect([BOB, CARA]).toContain(next.crown);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN));
  expect(next.steps).toHaveLength(0);
});

test("not usable in 2-player games", () => {
  const two = {
    ...rawGenesis([ANN, BOB], EMPEROR_CAST),
    claimed: [{ seat: ANN, character: "emperor" }],
    crown: BOB,
  };
  const next = emperor(ctxFor(two));
  expect(next.crown).toBe(BOB);
  expect(rawGold(next, ANN)).toBe(rawGold(two, ANN));
  expect(next.steps).toHaveLength(0);
});

test("the ability is not a no-op: it pays gold, moves the crown, and opens the crown window", () => {
  const state = withCity(emperorState(), ANN, ["manor", "castle"]);
  const next = emperor(ctxFor(state));
  expect(rawGold(next, ANN)).toBeGreaterThan(rawGold(state, ANN));
  expect(next.crown).toBe(ANN);
  expect(next.steps[0]).toMatchObject({ kind: "window", window: { purpose: "emperor-crown" } });
});
