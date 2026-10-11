import type { DistrictType } from "./districts.ts";
import { CitadelsError } from "./error.ts";

/**
 * The character domain. 27 characters across ranks 1-9, three per rank. Each
 * rank-1..8 character plus optionally one rank-9 character forms a game's cast
 * (`validateCast` in setup.ts). The catalog is pure data: rank, the income
 * ability, whether it takes the crown, and a one-line summary. Every character's
 * ability lives in `characters/<id>.ts`.
 */

export type CharacterId =
  | "assassin"
  | "thief"
  | "magician"
  | "king"
  | "bishop"
  | "merchant"
  | "architect"
  | "warlord"
  | "witch"
  | "tax-collector"
  | "wizard"
  | "emperor"
  | "abbot"
  | "alchemist"
  | "navigator"
  | "diplomat"
  | "artist"
  | "queen"
  | "magistrate"
  | "blackmailer"
  | "spy"
  | "seer"
  | "patrician"
  | "cardinal"
  | "trader"
  | "scholar"
  | "marshal";

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** What each counted district yields: gold, a card, or the holder's choice of either. */
export type IncomeGrant =
  | { readonly kind: "gold" }
  | { readonly kind: "cards" }
  | { readonly kind: "gold-or-cards" };

/**
 * A character's resource-gathering bonus: it counts its own districts of
 * `counts` type and yields `grants` per one. King and Emperor take gold per
 * noble, Patrician a card per noble; Bishop gold per religious, Cardinal a card,
 * Abbot the holder's choice; Merchant and Trader gold per trade; Warlord,
 * Diplomat, and Marshal gold per military. `null` means no income ability.
 */
export interface CharacterIncome {
  readonly counts: DistrictType;
  readonly grants: IncomeGrant;
}

export interface CharacterSpec {
  readonly id: CharacterId;
  readonly name: string;
  readonly rank: Rank;
  readonly income: CharacterIncome | null;
  /** True when the character must take the crown (King, Emperor, Patrician). */
  readonly crown: boolean;
  readonly summary: string;
}

const goldFrom = (counts: DistrictType): CharacterIncome => ({ counts, grants: { kind: "gold" } });

export const CHARACTER_CATALOG: readonly CharacterSpec[] = [
  {
    id: "assassin",
    name: "Assassin",
    rank: 1,
    income: null,
    crown: false,
    summary: "Name a character; that character is killed and skips its turn.",
  },
  {
    id: "witch",
    name: "Witch",
    rank: 1,
    income: null,
    crown: false,
    summary: "Gather, then name a character to bewitch; its owner's turn is cut short and you resume as the bewitched character.",
  },
  {
    id: "magistrate",
    name: "Magistrate",
    rank: 1,
    income: null,
    crown: false,
    summary: "Warrant a character; when they pay to build, confiscate that district for free and refund their gold.",
  },
  {
    id: "thief",
    name: "Thief",
    rank: 2,
    income: null,
    crown: false,
    summary: "Name a character; when it is called you take all of its owner's gold.",
  },
  {
    id: "spy",
    name: "Spy",
    rank: 2,
    income: null,
    crown: false,
    summary: "Name a player and a district type; for each matching card in that player's hand, take 1 gold and gain 1 card.",
  },
  {
    id: "blackmailer",
    name: "Blackmailer",
    rank: 2,
    income: null,
    crown: false,
    summary: "Assign two threat markers; a threatened player bribes you or lets you reveal the flowered lace to take all their gold.",
  },
  {
    id: "magician",
    name: "Magician",
    rank: 3,
    income: null,
    crown: false,
    summary: "Swap your entire hand with another player's, or discard any number of cards to the bottom of the deck and draw an equal number.",
  },
  {
    id: "wizard",
    name: "Wizard",
    rank: 3,
    income: null,
    crown: false,
    summary: "Look at a player's hand and take one district card from it.",
  },
  {
    id: "seer",
    name: "Seer",
    rank: 3,
    income: null,
    crown: false,
    summary: "Take a card at random from every other player's hand, then give one card back to each.",
  },
  {
    id: "king",
    name: "King",
    rank: 4,
    income: goldFrom("noble"),
    crown: true,
    summary: "Take the crown and 1 gold per noble district in your city.",
  },
  {
    id: "emperor",
    name: "Emperor",
    rank: 4,
    income: goldFrom("noble"),
    crown: true,
    summary: "Take the crown, give the crown to a player, and collect 1 gold per noble district.",
  },
  {
    id: "patrician",
    name: "Patrician",
    rank: 4,
    income: { counts: "noble", grants: { kind: "cards" } },
    crown: true,
    summary: "Take the crown and collect 1 card per noble district in your city.",
  },
  {
    id: "bishop",
    name: "Bishop",
    rank: 5,
    income: goldFrom("religious"),
    crown: false,
    summary: "Collect 1 gold per religious district; the rank 8 character cannot use its ability on your districts this round.",
  },
  {
    id: "abbot",
    name: "Abbot",
    rank: 5,
    income: { counts: "religious", grants: { kind: "gold-or-cards" } },
    crown: false,
    summary: "Collect 1 gold or 1 card per religious district; if you are not the richest, the richest player gives you 1 gold.",
  },
  {
    id: "cardinal",
    name: "Cardinal",
    rank: 5,
    income: { counts: "religious", grants: { kind: "cards" } },
    crown: false,
    summary: "Collect 1 card per religious district; cover a build shortfall from one player by giving them one card per gold taken.",
  },
  {
    id: "merchant",
    name: "Merchant",
    rank: 6,
    income: goldFrom("trade"),
    crown: false,
    summary: "Collect 1 gold per trade district and gain 1 extra gold.",
  },
  {
    id: "alchemist",
    name: "Alchemist",
    rank: 6,
    income: null,
    crown: false,
    summary: "At the end of your turn, take back the gold you paid to build districts this turn.",
  },
  {
    id: "trader",
    name: "Trader",
    rank: 6,
    income: goldFrom("trade"),
    crown: false,
    summary: "Collect 1 gold per trade district and build any number of trade districts beyond your limit.",
  },
  {
    id: "architect",
    name: "Architect",
    rank: 7,
    income: null,
    crown: false,
    summary: "Draw two extra cards and build up to three districts.",
  },
  {
    id: "navigator",
    name: "Navigator",
    rank: 7,
    income: null,
    crown: false,
    summary: "Take 4 gold, or draw 4 cards.",
  },
  {
    id: "scholar",
    name: "Scholar",
    rank: 7,
    income: null,
    crown: false,
    summary: "Draw seven cards, keep one and shuffle the rest back into the deck.",
  },
  {
    id: "warlord",
    name: "Warlord",
    rank: 8,
    income: goldFrom("military"),
    crown: false,
    summary: "Collect 1 gold per military district; pay to destroy one district.",
  },
  {
    id: "diplomat",
    name: "Diplomat",
    rank: 8,
    income: goldFrom("military"),
    crown: false,
    summary: "Collect 1 gold per military district; exchange a district in your city with a rival's.",
  },
  {
    id: "marshal",
    name: "Marshal",
    rank: 8,
    income: goldFrom("military"),
    crown: false,
    summary: "Collect 1 gold per military district; seize a district from a rival's city.",
  },
  {
    id: "artist",
    name: "Artist",
    rank: 9,
    income: null,
    crown: false,
    summary: "Beautify up to two districts, placing gold on them for end-game points.",
  },
  {
    id: "queen",
    name: "Queen",
    rank: 9,
    income: null,
    crown: false,
    summary: "Gain 3 gold if you sit next to the player who revealed the rank 4 character.",
  },
  {
    id: "tax-collector",
    name: "Tax Collector",
    rank: 9,
    income: null,
    crown: false,
    summary: "Every player who builds places 1 gold on your tax token; on your turn take all gold from the token.",
  },
];

/** The eight rank 1-8 basics: the cast of the base game. */
export const BASE_CAST: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

const BY_ID: ReadonlyMap<CharacterId, CharacterSpec> = new Map(
  CHARACTER_CATALOG.map((spec) => [spec.id, spec]),
);

export const isCharacterId = (value: string): value is CharacterId =>
  BY_ID.has(value as CharacterId);

export const asCharacterId = (value: string): CharacterId => {
  if (!isCharacterId(value)) throw new CitadelsError(`unknown character: ${value}`);
  return value;
};

export const isRank = (value: number): value is Rank =>
  Number.isInteger(value) && value >= 1 && value <= 9;

export const asRank = (value: number): Rank => {
  if (!isRank(value)) throw new CitadelsError(`unknown rank: ${String(value)}`);
  return value;
};

export const specOfCharacter = (id: CharacterId): CharacterSpec => {
  const spec = BY_ID.get(id);
  if (spec === undefined) throw new CitadelsError(`unknown character: ${id}`);
  return spec;
};

export const charactersOfRank = (rank: Rank): readonly CharacterId[] =>
  CHARACTER_CATALOG.filter((spec) => spec.rank === rank).map((spec) => spec.id);
