import type { Random, Roster, SeatId } from "../../index.ts";
import { specOfCharacter, type CharacterId, type Rank } from "./characters.ts";
import { buildDeck, DEFAULT_UNIQUES, type DistrictId } from "./districts.ts";
import { CitadelsError } from "./error.ts";
import type { CitadelsPlayer, CitadelsState, DraftState, Step } from "./state.ts";
import { windowKindFor } from "./state.ts";

export interface CitadelsSetup {
  readonly cast: readonly CharacterId[];
  /** The 14 unique districts in the deck. Defaults to `DEFAULT_UNIQUES`. */
  readonly uniques?: readonly DistrictId[];
}

export const STARTING_GOLD = 2;
export const STARTING_HAND = 4;
/** A city of eight districts ends the game; seven while the Bell Tower is in play. */
export const CITY_TARGET = 8;
/** The rank that can never be dealt into the public faceup discards. */
const PROTECTED_RANK: Rank = 4;

const ranksOf = (cast: readonly CharacterId[]): readonly Rank[] =>
  cast.map((id) => specOfCharacter(id).rank);

export const validateCast = (cast: readonly CharacterId[]): void => {
  if (cast.length !== 8 && cast.length !== 9) {
    throw new CitadelsError(`a cast is 8 or 9 characters, got ${String(cast.length)}`);
  }
  if (new Set(cast).size !== cast.length) {
    throw new CitadelsError("cast characters must be distinct");
  }
  const seen = new Set<Rank>();
  for (const rank of ranksOf(cast)) {
    if (seen.has(rank)) throw new CitadelsError(`two characters of rank ${String(rank)}`);
    seen.add(rank);
  }
  for (let rank = 1; rank <= 8; rank += 1) {
    if (!seen.has(rank as Rank)) throw new CitadelsError(`cast is missing rank ${String(rank)}`);
  }
  if (cast.length === 9 && !seen.has(9)) {
    throw new CitadelsError("a nine-character cast needs one rank-9 character");
  }
};

/** Canonical cast order: ascending rank. Two peers then encode the same cast. */
export const orderCast = (cast: readonly CharacterId[]): readonly CharacterId[] =>
  [...cast].sort((a, b) => specOfCharacter(a).rank - specOfCharacter(b).rank);

/**
 * Build the passing draft: shuffle the cast, set the public/hidden discards, and
 * seat the pickers in crown order. A rank-4 character is never public.
 */
export const buildDraft = (
  cast: readonly CharacterId[],
  seats: readonly SeatId[],
  rng: Random,
): DraftState => {
  const perSeat = seats.length <= 3 ? 2 : 1;
  const pool = rng.shuffle(cast);
  const pickedCount = seats.length * perSeat;
  // One-pick games keep a spare in the passing pool so the last picker still
  // has a choice: the catalog's "4 players: 2 faceup, 1 facedown" removes
  // three of the eight. Two-pick games (2-3 players) discard their remainder,
  // and a pool with only one character left has no spare to keep.
  const extras = pool.length - pickedCount;
  const remaining = perSeat === 2 || extras <= 1 ? extras : extras - 1;
  const facedownCount = remaining >= 1 ? 1 : 0;
  const faceupCount = remaining - facedownCount;
  const discards = pool.slice(0, remaining);
  const faceup = discards
    .filter((id) => specOfCharacter(id).rank !== PROTECTED_RANK)
    .slice(0, faceupCount);
  const facedown = discards.filter((id) => !faceup.includes(id));
  const passing = pool.slice(remaining);
  const order: SeatId[] = [];
  for (let pass = 0; pass < perSeat; pass += 1) order.push(...seats);
  const picker = order[0] ?? seats[0];
  if (picker === undefined) throw new CitadelsError("citadels needs at least one seat");
  return { pool: passing, picker, order, picks: [], faceup, facedown, perSeat };
};

const openingStep = (picker: SeatId): Step => ({
  kind: "window",
  window: { kind: windowKindFor("draft-pick"), purpose: "draft-pick", seats: [picker] },
});

export const genesisState = (
  setup: CitadelsSetup,
  roster: Roster,
  rng: Random,
): CitadelsState => {
  validateCast(setup.cast);
  const seats = roster.order;
  const crown = seats[0];
  if (crown === undefined) throw new CitadelsError("citadels needs at least one seat");
  const uniques = setup.uniques ?? DEFAULT_UNIQUES;
  if (uniques.length !== 14) {
    throw new CitadelsError(`a deck carries 14 unique districts, got ${String(uniques.length)}`);
  }
  const deck = buildDeck(uniques, rng);
  const needed = STARTING_HAND * seats.length;
  if (deck.length < needed) {
    throw new CitadelsError(
      `the deck has ${String(deck.length)} cards but ${String(needed)} are needed to deal`,
    );
  }
  const players: readonly CitadelsPlayer[] = seats.map((seat, index) => ({
    seat,
    gold: STARTING_GOLD,
    hand: deck.slice(index * STARTING_HAND, (index + 1) * STARTING_HAND),
    city: [],
  }));
  const draft = buildDraft(setup.cast, seats, rng);
  return {
    cast: orderCast(setup.cast),
    players,
    deck: deck.slice(needed),
    discard: [],
    crown,
    round: 0,
    phase: "draft",
    draft,
    callRank: 1,
    active: crown,
    steps: [openingStep(draft.picker)],
    claimed: [],
    skipped: [],
    pending: null,
    completed: [],
    resigned: [],
  };
};
