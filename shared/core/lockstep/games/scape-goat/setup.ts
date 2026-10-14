import type { Random, Roster, SeatId } from "../../index.ts";
import { deckFor, HAND_SIZE, type CardId } from "./cards.ts";
import { ScapeGoatError } from "./error.ts";
import { LOCATION_LINE } from "./locations.ts";
import {
  MAX_SEATS,
  MIN_SEATS,
  type Destination,
  type PlayerCount,
  type PlayerState,
  type ScapeGoatState,
} from "./state.ts";

/**
 * The whole lobby surface. The card mix is deliberately not here: it is a module
 * constant, so two peers cannot disagree about the deck by agreeing on a bad
 * setup.
 */
export interface ScapeGoatSetup {
  readonly spyReveal: "private" | "public";
}

export const validateSetup = (setup: ScapeGoatSetup, roster: Roster): PlayerCount => {
  const count = roster.order.length;
  if (count < MIN_SEATS || count > MAX_SEATS) {
    throw new ScapeGoatError(`scape-goat needs 3 to 6 seats, got ${String(count)}`);
  }
  if (setup.spyReveal !== "private" && setup.spyReveal !== "public") {
    throw new ScapeGoatError(`unknown spyReveal: ${String(setup.spyReveal)}`);
  }
  return count as PlayerCount;
};

/** A seat other than `seat`, drawn uniformly; the scapegoat's own mat names this decoy. */
const pickOther = (order: readonly SeatId[], seat: SeatId, rng: Random): SeatId => {
  const others = order.filter((candidate) => candidate !== seat);
  const picked = others[rng.int(others.length)];
  if (picked === undefined) throw new ScapeGoatError("scape-goat needs at least two seats");
  return picked;
};

/**
 * Build the initial state. Every shuffle and draw happens here, once, so all
 * peers build the same hidden deck from the same seed and `step` never needs
 * `rng`. The deal is total: four face-up cards, three facedown Stash cards, then
 * `HAND_SIZE` to each seat, consuming `deckFor(count)` exactly.
 */
export const genesisState = (setup: ScapeGoatSetup, roster: Roster, rng: Random): ScapeGoatState => {
  const count = validateSetup(setup, roster);
  const deck = rng.shuffle(deckFor(count));
  const placement = rng.shuffle(roster.order);
  const scapegoat = roster.order[rng.int(count)];
  if (scapegoat === undefined) throw new ScapeGoatError("scape-goat needs at least one seat");
  const scapegoatSuspect = pickOther(roster.order, scapegoat, rng);
  const handSize = HAND_SIZE[count];

  const players = roster.order.map((seat, index): PlayerState => {
    const placed = placement.indexOf(seat);
    const at = LOCATION_LINE[(placed < 0 ? index : placed) % LOCATION_LINE.length];
    if (at === undefined) throw new ScapeGoatError("scape-goat has no locations");
    return {
      seat,
      at,
      hand: deck.slice(7 + index * handSize, 7 + (index + 1) * handSize),
      prepTokens: 0,
    };
  });

  const [prepareCard, spyCard, tradeCard, stashCard] = deck;
  const stash = deck.slice(4, 7);
  if (
    prepareCard === undefined ||
    spyCard === undefined ||
    tradeCard === undefined ||
    stashCard === undefined
  ) {
    throw new ScapeGoatError("scape-goat deck is too small to open the locations");
  }
  const faceUp: Readonly<Record<Destination, CardId>> = {
    prepare: prepareCard,
    spy: spyCard,
    trade: tradeCard,
    stash: stashCard,
  };

  // The first-pass occupant of Prepare moves first; placement[0] is that seat.
  const active = placement[0];
  if (active === undefined) throw new ScapeGoatError("scape-goat needs at least one seat");

  return {
    players,
    scapegoat,
    scapegoatSuspect,
    faceUp,
    stash,
    prepareTokens: 2,
    spy: null,
    frame: null,
    phase: { kind: "move", active },
    resigned: [],
    spyReveal: setup.spyReveal,
  };
};
