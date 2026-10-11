import { expect, test } from "vitest";
import {
  COLOURS,
  EVIDENCE_CARDS,
  HAND_SIZE,
  cardIdsInPlay,
  cardsConserved,
  coloursOf,
  deckFor,
  rawGenesis,
} from "./driver.ts";
import type { CardFace, PlayerCount } from "../../../lockstep/games/scape-goat/index.ts";

const COUNTS: readonly PlayerCount[] = [3, 4, 5, 6];

const markerKey = (card: CardFace): string => {
  if (card.counts.length === 4) return "3+";
  if (card.counts.length === 3) return "4+";
  if (card.counts.length === 2) return "5+";
  return String(card.counts[0]);
};

const groupSizes = (): Readonly<Record<string, number>> => {
  const groups: Record<string, number> = {};
  for (const card of EVIDENCE_CARDS) {
    const key = markerKey(card);
    groups[key] = (groups[key] ?? 0) + 1;
  }
  return groups;
};

test("the box holds 30 cards", () => {
  expect(EVIDENCE_CARDS.length).toBe(30);
});

test("the marker groups are sized exactly as the design states", () => {
  const groups = groupSizes();
  expect(groups["3+"]).toBe(13);
  expect(groups["4+"]).toBe(3);
  expect(groups["5+"]).toBe(1);
  expect(groups["6"]).toBe(2);
  expect(groups["3"]).toBe(3);
  expect(groups["4"]).toBe(3);
  expect(groups["5"]).toBe(5);
});

test("deckFor(N) is dealt exactly: 7 + N * HAND_SIZE[N]", () => {
  const expected: Readonly<Record<PlayerCount, number>> = { 3: 16, 4: 19, 5: 22, 6: 19 };
  for (const count of COUNTS) {
    expect(deckFor(count).length).toBe(7 + count * HAND_SIZE[count]);
    expect(deckFor(count).length).toBe(expected[count]);
  }
});

test("every legal colour survives on at least N-1 cards in deckFor(N)", () => {
  for (const count of COUNTS) {
    const deck = deckFor(count);
    for (const colour of COLOURS.slice(0, count)) {
      const supply = deck.filter((id) => coloursOf(id).includes(colour));
      expect(supply.length).toBeGreaterThanOrEqual(count - 1);
    }
  }
});

test("HAND_SIZE is a constant per count and is only ever two or three", () => {
  expect(HAND_SIZE).toEqual({ 3: 3, 4: 3, 5: 3, 6: 2 });
  for (const count of COUNTS) {
    expect(HAND_SIZE[count] === 2 || HAND_SIZE[count] === 3).toBe(true);
  }
});

test("no state field holds a draw pile", () => {
  // The design's determinism rests on the deal consuming the deck exactly, with
  // no leftover pile: a state that carried one would need an rng draw in `step`.
  const state = rawGenesis(4, "cards-no-deck").state;
  const keys = Object.keys(state);
  for (const absent of ["deck", "drawPile", "discard", "draw", "pile"]) {
    expect(keys).not.toContain(absent);
  }
});

test("card conservation holds at genesis for every count", () => {
  for (const count of COUNTS) {
    const state = rawGenesis(count, `cards-conserve-${count}`).state;
    const ids = cardIdsInPlay(state);
    expect(ids.length).toBe(deckFor(count).length);
    expect(new Set(ids).size).toBe(deckFor(count).length);
    expect(cardsConserved(state, count)).toBe(true);
  }
});

test("a card is never duplicated between two hands at genesis", () => {
  const state = rawGenesis(5, "cards-no-dupes").state;
  const all = state.players.flatMap((player) => [...player.hand]);
  expect(new Set(all).size).toBe(all.length);
});
