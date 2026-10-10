import { expect, test } from "vitest";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import {
  SCHOLAR_BUILD_LIMIT,
  SCHOLAR_DRAW,
  scholar,
} from "../../../../lockstep/games/citadels/characters/scholar.ts";
import type { CitadelsState, Step } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawHand,
  rawRandom,
  totalCards,
} from "../driver.ts";

const CAST: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "scholar",
  "warlord",
];

/** A turn-phase state: the draft is over and the Scholar is claimed by ANN. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, CAST),
  phase: "turn",
  draft: null,
  claimed: [{ seat: ANN, character: "scholar" }],
  callRank: 1,
  active: ANN,
  steps: [],
});

/** The Scholar's own turn window plus the round continuation below it. */
const OWN_TURN: Step = { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } };
const ROUND_REST: readonly Step[] = [
  OWN_TURN,
  { kind: "end-turn" },
  { kind: "call" },
  { kind: "end-round" },
];

const openScholar = (state: CitadelsState, rest: readonly Step[] = []): CitadelsState =>
  scholar({ state, seat: ANN, rest, rng: rawRandom() });

/** Resolve the open scholar-keep window with hand index `index` (or a pass). */
const keep = (state: CitadelsState, index: number | null): CitadelsState =>
  advance(state, (seat) => (seat === ANN && index !== null ? { t: "keep", index } : null));

const purposes = (state: CitadelsState): readonly string[] =>
  state.steps.flatMap((step) => (step.kind === "window" ? [step.window.purpose] : []));

const turnWindows = (state: CitadelsState): number =>
  state.steps.filter(
    (step) =>
      step.kind === "window" && step.window.purpose === "turn" && step.window.seats.includes(ANN),
  ).length;

test("draw seven cards from the deck", () => {
  const state = turnState();
  const opened = openScholar(state);
  expect(SCHOLAR_DRAW).toBe(7);
  // The seven cards leave the deck into flight, held until the keep resolves.
  expect(opened.deck).toHaveLength(state.deck.length - SCHOLAR_DRAW);
  expect(opened.pending?.cards).toHaveLength(SCHOLAR_DRAW);
});

test("choose one to add to your hand", () => {
  const state = turnState();
  const opened = openScholar(state);
  expect(openPurpose(opened)).toBe("scholar-keep");
  const chosen = opened.pending?.cards[3];
  const next = keep(opened, 3);
  expect(rawHand(next, ANN)).toContain(chosen);
  expect(rawHand(next, ANN)).toHaveLength(rawHand(state, ANN).length + 1);
  expect(next.pending).toBeNull();
});

test("shuffle the other six back into the deck", () => {
  const state = turnState();
  const opened = openScholar(state);
  const kept = (opened.pending?.cards ?? [])[2] as string;
  const next = keep(opened, 2);
  // The deck ends as the original deck with exactly one instance of the kept card
  // removed: six of the seven returned, the seventh is in the Scholar's hand.
  const remaining = [...state.deck];
  remaining.splice(remaining.indexOf(kept), 1);
  expect(next.deck).toHaveLength(state.deck.length - 1);
  expect([...next.deck].sort()).toEqual(remaining.sort());
  expect(next.deck.filter((id) => id === kept)).toHaveLength(
    state.deck.filter((id) => id === kept).length - 1,
  );
});

test("the district deck is conserved through the draw and the return", () => {
  const state = turnState();
  const opened = openScholar(state);
  const next = keep(opened, 0);
  expect(totalCards(next)).toBe(totalCards(state));
});

test("your building limit this turn is two", () => {
  const state = openScholar(turnState(), ROUND_REST);
  expect(SCHOLAR_BUILD_LIMIT).toBe(2);
  expect(turnWindows(state)).toBe(2);
  // The two build windows sit above the round's own continuation.
  const afterKeep = keep(state, 0);
  expect(purposes(afterKeep).slice(0, 2)).toEqual(["turn", "turn"]);
});

test("a killed scholar draws nothing and opens no window", () => {
  const base = { ...turnState(), skipped: ["scholar"] as readonly CharacterId[] };
  const next = openScholar(base, ROUND_REST);
  expect(next.deck).toEqual(base.deck);
  expect(next.pending).toBeNull();
  // No scholar-keep window opens; the round continuation rides through untouched.
  expect(openPurpose(next)).toBe("turn");
  expect(purposes(next)).not.toContain("scholar-keep");
  expect(next.steps).toEqual(ROUND_REST);
});

test("the ability is not a no-op: it opens the keep window and moves a card", () => {
  const state = turnState();
  const opened = openScholar(state);
  expect(openPurpose(opened)).toBe("scholar-keep");
  const next = keep(opened, 0);
  expect(rawHand(next, ANN).length).toBeGreaterThan(rawHand(state, ANN).length);
  expect(next.deck).not.toEqual(state.deck);
});
