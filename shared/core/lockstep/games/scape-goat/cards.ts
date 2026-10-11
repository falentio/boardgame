import type { Colour, PlayerCount } from "./state.ts";

/**
 * A card id. Branded so a card cannot be handed where a seat belongs, and so a
 * snapshot at the decode boundary must carry an id the catalog knows, which is
 * what stops an unknown string from reading as grey.
 */
export type CardId = string & { readonly __brand: "CardId" };

export const cardId = (raw: string): CardId => raw as CardId;

/**
 * Cards dealt to each hand at each count. The rulebook allows two or three and
 * never says which; the deal equation `deckFor(count).length === 7 + count * HAND_SIZE[count]`
 * pins the choice, and at three players a two-card hand would make a frame need
 * both other players to hold the colour.
 */
export const HAND_SIZE: Readonly<Record<PlayerCount, 2 | 3>> = { 3: 3, 4: 3, 5: 3, 6: 2 };

export interface CardFace {
  readonly id: CardId;
  /** The player colours printed on the card. Grey — matching nothing — is the empty set. */
  readonly colours: readonly Colour[];
  /** The player counts this face is legal in, ascending. */
  readonly counts: readonly PlayerCount[];
}

/** Marker groups: the counts a face is legal in. */
const THREE_PLUS: readonly PlayerCount[] = [3, 4, 5, 6];
const FOUR_PLUS: readonly PlayerCount[] = [4, 5, 6];
const FIVE_PLUS: readonly PlayerCount[] = [5, 6];
const SIX_ONLY: readonly PlayerCount[] = [6];
const THREE_ONLY: readonly PlayerCount[] = [3];
const FOUR_ONLY: readonly PlayerCount[] = [4];
const FIVE_ONLY: readonly PlayerCount[] = [5];

const face = (
  id: string,
  colours: readonly Colour[],
  counts: readonly PlayerCount[],
): CardFace => ({ id: cardId(id), colours, counts });

/**
 * The 30 authored card faces. A card's marker is the set of counts it is legal
 * in; grey is the empty colour set. Two invariants hold by arithmetic and are
 * what the rules need: every card in `deckFor(count)` is dealt exactly, and every
 * legal colour survives on at least `count - 1` cards, so a frame can still be
 * assembled at that table.
 */
export const EVIDENCE_CARDS: readonly CardFace[] = [
  // 3+ — the shared core of every deck; five cards bear each of the six colours.
  face("goat-horns", ["red", "blue"], THREE_PLUS),
  face("goat-beard", ["red", "green"], THREE_PLUS),
  face("goat-hooves", ["blue", "green"], THREE_PLUS),
  face("goat-tail", ["yellow", "purple"], THREE_PLUS),
  face("goat-ears", ["yellow", "orange"], THREE_PLUS),
  face("goat-eyes", ["purple", "orange"], THREE_PLUS),
  face("goat-nose", ["red", "yellow"], THREE_PLUS),
  face("goat-teeth", ["blue", "purple"], THREE_PLUS),
  face("goat-bleat", ["green", "orange"], THREE_PLUS),
  face("goat-herd", ["red", "blue", "green"], THREE_PLUS),
  face("goat-mountain", ["yellow", "purple", "orange"], THREE_PLUS),
  face("goat-bystander", [], THREE_PLUS),
  face("goat-panorama", ["red", "blue", "green", "yellow", "purple", "orange"], THREE_PLUS),

  // 4+
  face("goat-fence", ["red", "yellow"], FOUR_PLUS),
  face("goat-bridge", ["blue", "purple"], FOUR_PLUS),
  face("goat-orchard", ["green", "orange"], FOUR_PLUS),

  // 5+
  face("goat-tollbooth", ["red", "blue", "green"], FIVE_PLUS),

  // 6
  face("goat-tower", ["yellow", "purple", "orange"], SIX_ONLY),
  face("goat-parade", ["red", "blue", "green", "yellow", "purple", "orange"], SIX_ONLY),

  // 3
  face("goat-kid", ["red", "blue"], THREE_ONLY),
  face("goat-nanny", ["blue", "green"], THREE_ONLY),
  face("goat-billy", ["red", "green"], THREE_ONLY),

  // 4
  face("goat-cart", ["yellow"], FOUR_ONLY),
  face("goat-wheel", ["red", "yellow"], FOUR_ONLY),
  face("goat-saddle", ["green", "yellow"], FOUR_ONLY),

  // 5
  face("goat-lantern", [], FIVE_ONLY),
  face("goat-rope", ["purple"], FIVE_ONLY),
  face("goat-bucket", ["red", "purple"], FIVE_ONLY),
  face("goat-ladder", ["blue", "yellow"], FIVE_ONLY),
  face("goat-milk", ["green", "yellow"], FIVE_ONLY),
];

export const deckFor = (count: PlayerCount): readonly CardId[] =>
  EVIDENCE_CARDS.filter((card) => card.counts.includes(count)).map((card) => card.id);

export const cardFaceOf = (id: CardId): CardFace | null =>
  EVIDENCE_CARDS.find((card) => card.id === id) ?? null;

/**
 * The colours on a card, or none for a missing pick or an unknown id. Total by
 * design: the frame resolver reads it for every reveal and must never throw.
 */
export const coloursOf = (id: CardId | null): readonly Colour[] =>
  id === null ? [] : (cardFaceOf(id)?.colours ?? []);
