import { expect, test } from "vitest";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import {
  ARCHITECT_BUILD_LIMIT,
  ARCHITECT_EXTRA_CARDS,
  architect,
} from "../../../../lockstep/games/citadels/characters/architect.ts";
import type { CitadelsState, Step } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  SEATS3,
  rawGenesis,
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
  "architect",
  "warlord",
];

/** A turn-phase state: the draft is over and the Architect is claimed by ANN. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, CAST),
  phase: "turn",
  draft: null,
  claimed: [{ seat: ANN, character: "architect" }],
  callRank: 1,
  active: ANN,
  steps: [],
});

/** The Architect's own turn window plus the round continuation below it. */
const OWN_TURN: Step = { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } };
const ROUND_REST: readonly Step[] = [
  OWN_TURN,
  { kind: "end-turn" },
  { kind: "call" },
  { kind: "end-round" },
];

const openArchitect = (state: CitadelsState, rest: readonly Step[] = []): CitadelsState =>
  architect({ state, seat: ANN, rest, rng: rawRandom() });

const purposes = (state: CitadelsState): readonly string[] =>
  state.steps.flatMap((step) => (step.kind === "window" ? [step.window.purpose] : []));

const turnWindows = (state: CitadelsState): number =>
  state.steps.filter(
    (step) =>
      step.kind === "window" &&
      step.window.purpose === "turn" &&
      step.window.seats.includes(ANN),
  ).length;

test("gain two extra cards", () => {
  const state = turnState();
  const next = openArchitect(state);
  expect(rawHand(next, ANN)).toHaveLength(rawHand(state, ANN).length + ARCHITECT_EXTRA_CARDS);
  expect(next.deck).toHaveLength(state.deck.length - ARCHITECT_EXTRA_CARDS);
});

test("usable regardless of which resource you gathered this turn", () => {
  // The gather is not read: a gold-rich state and a hand-rich state (as if the
  // Architect had drawn instead) both draw exactly two extra cards.
  const gatheredGold = withGold(turnState(), ANN, 12);
  const gatheredCards = withHand(turnState(), ANN, [
    "tavern",
    "market",
    "docks",
    "harbor",
    "temple",
    "church",
  ]);
  const fromGold = openArchitect(gatheredGold);
  const fromCards = openArchitect(gatheredCards);
  expect(rawHand(fromGold, ANN).length - rawHand(gatheredGold, ANN).length).toBe(
    ARCHITECT_EXTRA_CARDS,
  );
  expect(rawHand(fromCards, ANN).length - rawHand(gatheredCards, ANN).length).toBe(
    ARCHITECT_EXTRA_CARDS,
  );
});

test("your building limit this turn is three", () => {
  const state = openArchitect(turnState(), ROUND_REST);
  expect(ARCHITECT_BUILD_LIMIT).toBe(3);
  expect(turnWindows(state)).toBe(3);
  // The three build windows sit above the round's own end-turn/call continuation.
  expect(purposes(state).slice(0, 3)).toEqual(["turn", "turn", "turn"]);
  expect(state.steps.slice(3)).toEqual(ROUND_REST.slice(1));
});

test("a killed architect draws nothing and opens no extra build window", () => {
  const base = { ...turnState(), skipped: ["architect"] as readonly CharacterId[] };
  const next = openArchitect(base, ROUND_REST);
  expect(rawHand(next, ANN)).toEqual(rawHand(base, ANN));
  expect(turnWindows(next)).toBe(1);
});

test("the ability is not a no-op: it draws cards and raises the build limit", () => {
  const state = withGold(turnState(), ANN, 0);
  const next = openArchitect(state, ROUND_REST);
  expect(rawHand(next, ANN).length).toBeGreaterThan(rawHand(state, ANN).length);
  expect(turnWindows(next)).toBeGreaterThan(1);
});
