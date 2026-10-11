import type { Random, SeatId } from "../../index.ts";
import { CitadelsError } from "./error.ts";
import type { CitadelsState, PlacedDistrict } from "./state.ts";

/**
 * The district domain. A card is either a basic district (pure data: a colour,
 * a cost, and a count in the deck) or a unique district (a colour of its own
 * plus an effect that lives in `districts/effects.ts`, keyed by id). The
 * catalog is the single source of truth for costs, colours, and deck counts.
 */

export type DistrictType = "noble" | "religious" | "trade" | "military" | "unique";

/** Stable string id, the key into `UNIQUE_EFFECTS` and the value stored in state. */
export type DistrictId = string;

/** A trigger point a unique district may respond to. Declared once, engine-called. */
export type DistrictHook =
  | "onIncome"
  | "onDraw"
  | "onBuild"
  | "onEndTurn"
  | "onScoring"
  | "onDestroy"
  | "onRoundStart";

export const DISTRICT_HOOKS: readonly DistrictHook[] = [
  "onIncome",
  "onDraw",
  "onBuild",
  "onEndTurn",
  "onScoring",
  "onDestroy",
  "onRoundStart",
];

/**
 * What a build costs and whether it may proceed, as answered by one district.
 * Every field is optional; an absent field means "the engine's default" (the
 * catalog cost, a paid build, a legal build that consumes the turn's limit).
 */
export interface BuildTerms {
  /** The cost to charge, defaulting to the catalog cost. */
  readonly cost?: number;
  /** Cards from hand the build consumes in place of gold, at 1 card = 1 gold. */
  readonly payCards?: number;
  /** A district in the builder's own city the build destroys instead of paying. */
  readonly destroy?: boolean;
  /** False when the district may not be built now (Monument below five districts). */
  readonly legal?: boolean;
  /** False when this build must not consume the turn's build limit (Stables). */
  readonly countsAsBuild?: boolean;
}

/**
 * A district's pre-build answer, mirroring the trigger table: a card can price
 * itself, gate its own legality, pay alternatively, or decline the limit. The
 * engine folds the queries of every unique already in the builder's city and
 * then the query of the card being built, so a city card may discount a build.
 */
export type BuildQuery = (ctx: {
  readonly state: CitadelsState;
  readonly seat: SeatId;
  readonly card: DistrictId;
  readonly city: readonly PlacedDistrict[];
}) => BuildTerms;

export interface DistrictSpec {
  readonly id: DistrictId;
  readonly name: string;
  readonly type: DistrictType;
  readonly cost: number;
  /** How many physical copies of this card are in the deck. */
  readonly copies: number;
  /** True when the card has an effect in `districts/effects.ts`. */
  readonly unique: boolean;
}

const basic = (
  id: string,
  name: string,
  type: DistrictType,
  cost: number,
  copies: number,
): DistrictSpec => ({ id, name, type, cost, copies, unique: false });

const unique = (id: string, name: string, cost: number): DistrictSpec => ({
  id,
  name,
  type: "unique",
  cost,
  copies: 1,
  unique: true,
});

/** The 17 basic cards, 54 physical copies: 11 military, 12 noble, 11 religious, 20 trade. */
export const BASIC_DISTRICTS: readonly DistrictSpec[] = [
  basic("watchtower", "Watchtower", "military", 1, 3),
  basic("prison", "Prison", "military", 2, 3),
  basic("barracks", "Barracks", "military", 3, 3),
  basic("fortress", "Fortress", "military", 5, 2),

  basic("manor", "Manor", "noble", 3, 5),
  basic("castle", "Castle", "noble", 4, 4),
  basic("palace", "Palace", "noble", 5, 3),

  basic("temple", "Temple", "religious", 1, 3),
  basic("church", "Church", "religious", 2, 3),
  basic("monastery", "Monastery", "religious", 3, 3),
  basic("cathedral", "Cathedral", "religious", 5, 2),

  basic("tavern", "Tavern", "trade", 1, 5),
  basic("market", "Market", "trade", 2, 4),
  basic("trading-post", "Trading Post", "trade", 2, 3),
  basic("docks", "Docks", "trade", 3, 3),
  basic("harbor", "Harbor", "trade", 4, 3),
  basic("town-hall", "Town Hall", "trade", 5, 2),
];

/** The 30 unique districts; 14 of them are chosen into any one deck. */
export const UNIQUE_DISTRICTS: readonly DistrictSpec[] = [
  unique("armory", "Armory", 3),
  unique("basilica", "Basilica", 6),
  unique("capitol", "Capitol", 5),
  unique("dragon-gate", "Dragon Gate", 6),
  unique("factory", "Factory", 5),
  unique("framework", "Framework", 4),
  unique("gold-mine", "Gold Mine", 6),
  unique("great-wall", "Great Wall", 6),
  unique("haunted-quarter", "Haunted Quarter", 5),
  unique("imperial-treasury", "Imperial Treasury", 5),
  unique("ivory-tower", "Ivory Tower", 5),
  unique("keep", "Keep", 3),
  unique("laboratory", "Laboratory", 5),
  unique("library", "Library", 6),
  unique("map-room", "Map Room", 5),
  unique("monument", "Monument", 4),
  unique("museum", "Museum", 4),
  unique("necropolis", "Necropolis", 5),
  unique("observatory", "Observatory", 5),
  unique("park", "Park", 6),
  unique("poor-house", "Poor House", 4),
  unique("quarry", "Quarry", 4),
  unique("school-of-magic", "School of Magic", 6),
  unique("secret-vault", "Secret Vault", 4),
  unique("smithy", "Smithy", 5),
  unique("stables", "Stables", 4),
  unique("statue", "Statue", 3),
  unique("theater", "Theater", 3),
  unique("thieves-den", "Thieves' Den", 4),
  unique("wishing-well", "Wishing Well", 3),
];

export const DISTRICT_CATALOG: readonly DistrictSpec[] = [...BASIC_DISTRICTS, ...UNIQUE_DISTRICTS];

/**
 * Not a 2016 catalog card. Retained so `helpers.ts` keeps compiling until its
 * Bell Tower branch is retired; nothing in the deck can ever equal it, so
 * `bellTowerInPlay` stays false and the city target stays eight.
 */
export const BELL_TOWER: DistrictId = "bell-tower";

/** The 14 uniques a game deals unless the setup overrides them. */
export const DEFAULT_UNIQUES: readonly DistrictId[] = [
  "keep",
  "laboratory",
  "smithy",
  "library",
  "school-of-magic",
  "dragon-gate",
  "observatory",
  "great-wall",
  "factory",
  "museum",
  "park",
  "armory",
  "capitol",
  "monument",
];

const BY_ID: ReadonlyMap<DistrictId, DistrictSpec> = new Map(
  DISTRICT_CATALOG.map((spec) => [spec.id, spec]),
);

export const isDistrictId = (value: string): boolean => BY_ID.has(value);

export const asDistrictId = (value: string): DistrictId => {
  if (!isDistrictId(value)) throw new CitadelsError(`unknown district: ${value}`);
  return value;
};

export const specOfDistrict = (id: DistrictId): DistrictSpec => {
  const spec = BY_ID.get(id);
  if (spec === undefined) throw new CitadelsError(`unknown district: ${id}`);
  return spec;
};

export const typeOfDistrict = (id: DistrictId): DistrictType => specOfDistrict(id).type;

/**
 * The type a placed district counts as for colour counts and scoring: the type
 * its owner declared (Haunted Quarter, School of Magic) when one was recorded,
 * else its catalog type.
 */
export const typeOfPlaced = (district: PlacedDistrict): DistrictType =>
  district.declaredType ?? specOfDistrict(district.id).type;

/**
 * One entry per physical card: every basic copy in catalog order, then one copy
 * of each chosen unique, shuffled once. The returned order is the hidden deck.
 */
export const buildDeck = (uniques: readonly DistrictId[], rng: Random): readonly DistrictId[] => {
  const cards: DistrictId[] = [];
  for (const spec of BASIC_DISTRICTS) {
    for (let i = 0; i < spec.copies; i += 1) cards.push(spec.id);
  }
  for (const id of uniques) {
    const spec = specOfDistrict(id);
    if (!spec.unique) throw new CitadelsError(`${id} is not a unique district`);
    for (let i = 0; i < spec.copies; i += 1) cards.push(spec.id);
  }
  return rng.shuffle(cards);
};
