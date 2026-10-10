import { expect, test } from "vitest";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import {
  NAVIGATOR_CARDS,
  NAVIGATOR_CARDS_NOTE,
  NAVIGATOR_GOLD,
  navigator,
} from "../../../../lockstep/games/citadels/characters/navigator.ts";
import { emptyPending, withPending } from "../../../../lockstep/games/citadels/helpers.ts";
import type { CitadelsState, Step } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  SEATS3,
  rawGenesis,
  rawGold,
  rawHand,
  rawRandom,
  withGold,
  withHand,
} from "../driver.ts";

const CAST: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "navigator",
  "warlord",
];

/** A turn-phase state: the draft is over and the Navigator is claimed by ANN. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, CAST),
  phase: "turn",
  draft: null,
  claimed: [{ seat: ANN, character: "navigator" }],
  callRank: 1,
  active: ANN,
  steps: [],
});

/** The Navigator's windowless choice channel: pending.note marks the card branch. */
const choosingCards = (state: CitadelsState): CitadelsState =>
  withPending(state, { ...emptyPending(ANN, "navigator"), note: NAVIGATOR_CARDS_NOTE });

/** A rest stack carrying every build opportunity the engine could hand the seat. */
const OWN_TURN: Step = { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } };
const EXTRA_BUILD: Step = {
  kind: "window",
  window: { kind: "oneOf", purpose: "trader-build", seats: [ANN] },
};
const ROUND_REST: readonly Step[] = [
  OWN_TURN,
  EXTRA_BUILD,
  { kind: "end-turn" },
  { kind: "call" },
  { kind: "end-round" },
];

const openNavigator = (state: CitadelsState, rest: readonly Step[] = []): CitadelsState =>
  navigator({ state, seat: ANN, rest, rng: rawRandom() });

const purposes = (state: CitadelsState): readonly string[] =>
  state.steps.flatMap((step) => (step.kind === "window" ? [step.window.purpose] : []));

test("gain four gold", () => {
  const state = turnState();
  const next = openNavigator(state);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + NAVIGATOR_GOLD);
  expect(NAVIGATOR_GOLD).toBe(4);
  expect(rawHand(next, ANN)).toEqual(rawHand(state, ANN));
});

test("or four cards", () => {
  const state = choosingCards(turnState());
  const next = openNavigator(state);
  expect(rawHand(next, ANN)).toHaveLength(rawHand(state, ANN).length + NAVIGATOR_CARDS);
  expect(NAVIGATOR_CARDS).toBe(4);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN));
});

test("usable regardless of which resource you gathered this turn", () => {
  // The gather is never read: a gold-rich state and a hand-rich state (as if the
  // Navigator had drawn instead) take the identical four-gold gain.
  const gatheredGold = withGold(turnState(), ANN, 9);
  const gatheredCards = withHand(turnState(), ANN, [
    "tavern",
    "market",
    "docks",
    "harbor",
    "temple",
    "church",
  ]);
  const fromGold = openNavigator(gatheredGold);
  const fromCards = openNavigator(gatheredCards);
  expect(rawGold(fromGold, ANN) - rawGold(gatheredGold, ANN)).toBe(NAVIGATOR_GOLD);
  expect(rawGold(fromCards, ANN) - rawGold(gatheredCards, ANN)).toBe(NAVIGATOR_GOLD);
});

test("you cannot build any districts this turn, not even districts that would not count toward your building limit", () => {
  const state = openNavigator(turnState(), ROUND_REST);
  // Neither the limit build (turn) nor a non-counting build (trader-build) survives.
  expect(purposes(state)).not.toContain("turn");
  expect(purposes(state)).not.toContain("trader-build");
  // The round's own continuation is untouched.
  expect(state.steps).toEqual([
    { kind: "end-turn" },
    { kind: "call" },
    { kind: "end-round" },
  ]);
});

test("a killed navigator takes no turn: it gains nothing and leaves the rest untouched", () => {
  const base = { ...turnState(), skipped: ["navigator"] as readonly CharacterId[] };
  const next = openNavigator(base, ROUND_REST);
  expect(rawGold(next, ANN)).toBe(rawGold(base, ANN));
  expect(rawHand(next, ANN)).toEqual(rawHand(base, ANN));
  // The effect is a no-op when killed, so it hands the round continuation back as-is.
  expect(next.steps).toEqual(ROUND_REST);
});

test("the ability is not a no-op: it raises gold and removes the build window", () => {
  const state = turnState();
  expect(purposes(state)).toEqual([]);
  const next = openNavigator(state, ROUND_REST);
  expect(rawGold(next, ANN)).toBeGreaterThan(rawGold(state, ANN));
  expect(purposes(next)).not.toContain("turn");
});

test("the four-card branch is the same gain by cards, chosen through the windowless channel", () => {
  const gold = openNavigator(turnState());
  const cards = openNavigator(choosingCards(turnState()));
  expect(rawGold(cards, ANN)).toBeLessThan(rawGold(gold, ANN));
  expect(rawHand(cards, ANN).length).toBeGreaterThan(rawHand(gold, ANN).length);
});
