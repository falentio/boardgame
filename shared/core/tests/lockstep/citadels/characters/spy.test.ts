import { expect, test } from "vitest";
import { act } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { spy, spyResolve } from "../../../../lockstep/games/citadels/characters/spy.ts";
import { resolveChooseSeat } from "../../../../lockstep/games/citadels/helpers.ts";
import type { CitadelsState, Claim, Window } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  SEATS3,
  openPurpose,
  rawFrame,
  rawGenesis,
  rawGold,
  rawHand,
  rawRandom,
  withGold,
  withHand,
} from "../driver.ts";

const SPY_CAST: readonly CharacterId[] = [
  "assassin",
  "spy",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

type NamedType = "noble" | "religious" | "trade" | "military";

/** A turn-phase state: the draft is over and the rank cursor is armed. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, SPY_CAST),
  phase: "turn",
  draft: null,
  claimed: [{ seat: ANN, character: "spy" }] as readonly Claim[],
  callRank: 1,
  active: ANN,
  steps: [{ kind: "call" }, { kind: "end-round" }],
});

const topWindow = (state: CitadelsState): Window => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no open window");
  return top.window;
};

/** One pass of the Spy's effect, with ANN as its owner. */
const pass = (state: CitadelsState): CitadelsState =>
  spy({ state, seat: ANN, rest: [], rng: rawRandom() });

/** Choose BOB as the target through the shared choose-seat window. */
const chooseSeat = (state: CitadelsState): CitadelsState => {
  const opened = pass(state);
  const frame = rawFrame(0, [[ANN, act({ t: "target", seat: BOB })]]);
  return resolveChooseSeat({ state: opened, window: topWindow(opened), frame, rng: rawRandom() });
};

/** Name a district type through the Spy's own choose-type window. */
const chooseType = (state: CitadelsState, type: NamedType): CitadelsState => {
  const opened = pass(state);
  const frame = rawFrame(0, [[ANN, act({ t: "name-type", type })]]);
  return spyResolve({ state: opened, window: topWindow(opened), frame, rng: rawRandom() });
};

/** Run the Spy's whole effect: seat, type, the look, and the payout. */
const runSpy = (state: CitadelsState, type: NamedType): CitadelsState =>
  pass(pass(chooseType(chooseSeat(state), type)));

test("the Spy chooses another player and names a district type", () => {
  const afterSeat = pass(turnState());
  expect(openPurpose(afterSeat)).toBe("choose-seat");
  const afterType = pass(chooseSeat(turnState()));
  expect(openPurpose(afterType)).toBe("choose-type");
  expect(afterType.pending?.target).toBe(BOB);
  const frame = rawFrame(0, [[ANN, act({ t: "name-type", type: "trade" })]]);
  const named = spyResolve({ state: afterType, window: topWindow(afterType), frame, rng: rawRandom() });
  expect(named.pending?.namedType).toBe("trade");
});

test("the Spy looks at the named player's hand", () => {
  const state = withHand(turnState(), BOB, ["tavern", "market", "temple"]);
  const peeked = pass(chooseType(chooseSeat(state), "trade"));
  expect(peeked.pending?.cards).toEqual(["tavern", "market", "temple"]);
});

test("for each card of the named type the Spy takes 1 gold from that player and gains 1 card from the deck", () => {
  const state = withGold(withHand(turnState(), BOB, ["tavern", "market", "temple"]), BOB, 5);
  const spyHandBefore = rawHand(state, ANN).length;
  const deckBefore = state.deck.length;
  const next = runSpy(state, "trade");
  expect(rawGold(next, BOB)).toBe(3);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 2);
  expect(rawHand(next, ANN)).toHaveLength(spyHandBefore + 2);
  expect(next.deck).toHaveLength(deckBefore - 2);
});

test("when the player has fewer gold than matching cards the Spy takes all their gold and still gains a card per matching card", () => {
  const state = withGold(
    withHand(turnState(), BOB, ["tavern", "market", "trading-post"]),
    BOB,
    1,
  );
  const spyHandBefore = rawHand(state, ANN).length;
  const next = runSpy(state, "trade");
  expect(rawGold(next, BOB)).toBe(0);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 1);
  expect(rawHand(next, ANN)).toHaveLength(spyHandBefore + 3);
});

test("the Spy gains nothing when the named player holds no card of the named type", () => {
  const state = withGold(withHand(turnState(), BOB, ["tavern", "market"]), BOB, 5);
  const spyHandBefore = rawHand(state, ANN).length;
  const deckBefore = state.deck.length;
  const next = runSpy(state, "religious");
  expect(rawGold(next, BOB)).toBe(5);
  expect(rawHand(next, ANN)).toHaveLength(spyHandBefore);
  expect(next.deck).toHaveLength(deckBefore);
});

test("the ability is not a no-op: one matching card moves exactly one gold and one deck card", () => {
  const state = withGold(withHand(turnState(), BOB, ["temple", "tavern"]), BOB, 2);
  const next = runSpy(state, "religious");
  expect(rawGold(next, BOB)).toBe(1);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 1);
  expect(rawHand(next, ANN)).toHaveLength(rawHand(state, ANN).length + 1);
  expect(next.deck).toHaveLength(state.deck.length - 1);
});
