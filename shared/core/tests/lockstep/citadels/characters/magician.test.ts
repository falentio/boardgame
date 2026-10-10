import { expect, test } from "vitest";
import { magician } from "../../../../lockstep/games/citadels/characters/magician.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { type CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawHand,
  rawRandom,
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

/** A turn-phase state whose only continuation is the round's end. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, CAST),
  phase: "turn",
  draft: null,
  claimed: [],
  callRank: 1,
  active: ANN,
  steps: [],
});

/** Run the Magician's character effect, as the engine's resolve step would. */
const openMagician = (state: CitadelsState): CitadelsState =>
  magician({ state, seat: ANN, rest: [], rng: rawRandom() });

const swapState = (mine: readonly string[], theirs: readonly string[]): CitadelsState =>
  withHand(withHand(turnState(), ANN, mine), BOB, theirs);

test("the Magician exchanges its entire hand with another player's hand", () => {
  const armed = swapState(["tavern", "market"], ["docks", "harbor", "palace"]);
  const annBefore = [...rawHand(armed, ANN)];
  const bobBefore = [...rawHand(armed, BOB)];
  const opened = openMagician(armed);
  expect(openPurpose(opened)).toBe("magician-swap");
  const next = advance(opened, (seat) => (seat === ANN ? { t: "target", seat: BOB } : null));
  expect(rawHand(next, ANN)).toEqual(bobBefore);
  expect(rawHand(next, BOB)).toEqual(annBefore);
});

test("the Magician with zero cards simply takes the other player's hand", () => {
  const armed = swapState([], ["docks", "harbor"]);
  const bobBefore = [...rawHand(armed, BOB)];
  const next = advance(openMagician(armed), (seat) =>
    seat === ANN ? { t: "target", seat: BOB } : null,
  );
  expect(rawHand(next, ANN)).toEqual(bobBefore);
  expect(rawHand(next, BOB)).toEqual([]);
});

test("declining the exchange offers the discard option instead", () => {
  const armed = swapState(["tavern"], ["docks"]);
  const opened = openMagician(armed);
  const declined = advance(opened, () => null);
  expect(openPurpose(declined)).toBe("magician-discard");
  // Declining moves no cards.
  expect(rawHand(declined, ANN)).toEqual(["tavern"]);
  expect(rawHand(declined, BOB)).toEqual(["docks"]);
});

test("the Magician discards cards to the bottom of the deck and draws an equal number", () => {
  const armed = swapState(["tavern", "market", "docks"], []);
  const atDiscard = advance(openMagician(armed), () => null);
  const topOfDeck = atDiscard.deck[0];
  const deckSize = atDiscard.deck.length;
  const next = advance(atDiscard, (seat) => (seat === ANN ? { t: "keep", index: 0 } : null));
  // The discarded card is on the bottom; the card drawn came from the top.
  expect(next.deck[next.deck.length - 1]).toBe("tavern");
  expect(rawHand(next, ANN)).toHaveLength(3);
  expect(rawHand(next, ANN)).toContain(topOfDeck);
  expect(rawHand(next, ANN)).not.toContain("tavern");
  expect(next.deck).toHaveLength(deckSize);
});

test("the Magician may discard any number of cards, one at a time", () => {
  const armed = swapState(["tavern", "market", "docks", "temple"], []);
  let state = advance(openMagician(armed), () => null);
  for (let i = 0; i < 3; i += 1) {
    expect(openPurpose(state)).toBe("magician-discard");
    state = advance(state, (seat) => (seat === ANN ? { t: "keep", index: 0 } : null));
  }
  // Three discarded, three drawn back: the hand size is unchanged.
  expect(rawHand(state, ANN)).toHaveLength(4);
  expect(state.deck.slice(-3)).toEqual(["tavern", "market", "docks"]);
  // Passing closes the ability and leaves the hand alone.
  const closed = advance(state, () => null);
  expect(openPurpose(closed)).not.toBe("magician-discard");
  expect(rawHand(closed, ANN)).toHaveLength(4);
});

test("the Magician ability is not a no-op: it opens a window and moves cards", () => {
  const armed = swapState(["tavern"], ["docks"]);
  expect(rawHand(armed, ANN)).toEqual(["tavern"]);
  const opened = openMagician(armed);
  expect(openPurpose(opened)).toBe("magician-swap");
  const next = advance(opened, (seat) => (seat === ANN ? { t: "target", seat: BOB } : null));
  expect(rawHand(next, ANN)).not.toEqual(rawHand(armed, ANN));
  expect(rawHand(next, BOB)).not.toEqual(rawHand(armed, BOB));
});
