import type { Random } from "../../index.ts";
import { CitadelsError } from "./error.ts";

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
export type DistrictHook = "onIncome" | "onBuild" | "onEndTurn" | "onScoring" | "onDestroy";

export const DISTRICT_HOOKS: readonly DistrictHook[] = [
  "onIncome",
  "onBuild",
  "onEndTurn",
  "onScoring",
  "onDestroy",
];

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

const basic = (id: string, name: string, type: DistrictType, cost: number): DistrictSpec => ({
  id,
  name,
  type,
  cost,
  copies: 1,
  unique: false,
});

const unique = (id: string, name: string, cost: number): DistrictSpec => ({
  id,
  name,
  type: "unique",
  cost,
  copies: 1,
  unique: true,
});

/** The 54 basic districts: 11 military, 11 religious, 12 noble, 20 trade. */
export const BASIC_DISTRICTS: readonly DistrictSpec[] = [
  basic("watchtower", "Watchtower", "military", 1),
  basic("prison", "Prison", "military", 2),
  basic("barracks", "Barracks", "military", 3),
  basic("guardhouse", "Guardhouse", "military", 3),
  basic("armory", "Armory", "military", 4),
  basic("battlefield", "Battlefield", "military", 4),
  basic("fortress", "Fortress", "military", 5),
  basic("citadel", "Citadel", "military", 5),
  basic("war-academy", "War Academy", "military", 6),
  basic("arsenal", "Arsenal", "military", 6),
  basic("siege-works", "Siege Works", "military", 6),

  basic("shrine", "Shrine", "religious", 1),
  basic("church", "Church", "religious", 2),
  basic("baptistry", "Baptistry", "religious", 2),
  basic("monastery", "Monastery", "religious", 3),
  basic("abbey", "Abbey", "religious", 3),
  basic("priory", "Priory", "religious", 3),
  basic("cloister", "Cloister", "religious", 4),
  basic("sanctuary", "Sanctuary", "religious", 4),
  basic("grand-temple", "Grand Temple", "religious", 5),
  basic("basilica", "Basilica", "religious", 5),
  basic("holy-see", "Holy See", "religious", 6),

  basic("estate", "Estate", "noble", 2),
  basic("courtyard", "Courtyard", "noble", 2),
  basic("manor", "Manor", "noble", 3),
  basic("villa", "Villa", "noble", 3),
  basic("townhouse", "Townhouse", "noble", 3),
  basic("atrium", "Atrium", "noble", 3),
  basic("chateau", "Chateau", "noble", 4),
  basic("castle", "Castle", "noble", 4),
  basic("mansion", "Mansion", "noble", 4),
  basic("gallery", "Gallery", "noble", 4),
  basic("palace", "Palace", "noble", 5),
  basic("conservatory", "Conservatory", "noble", 5),

  basic("tavern", "Tavern", "trade", 1),
  basic("shop", "Shop", "trade", 1),
  basic("cart", "Cart", "trade", 1),
  basic("market", "Market", "trade", 2),
  basic("trading-post", "Trading Post", "trade", 2),
  basic("peddler", "Peddler", "trade", 2),
  basic("inn", "Inn", "trade", 3),
  basic("docks", "Docks", "trade", 3),
  basic("harbor", "Harbor", "trade", 3),
  basic("warehouse", "Warehouse", "trade", 3),
  basic("bazaar", "Bazaar", "trade", 3),
  basic("storehouse", "Storehouse", "trade", 3),
  basic("caravan", "Caravan", "trade", 4),
  basic("counting-house", "Counting House", "trade", 4),
  basic("fair", "Fair", "trade", 4),
  basic("exchange", "Exchange", "trade", 4),
  basic("guildhall", "Guildhall", "trade", 5),
  basic("grand-market", "Grand Market", "trade", 5),
  basic("emporium", "Emporium", "trade", 5),
  basic("mint", "Mint", "trade", 5),
];

/** The 30 unique districts; 14 of them are chosen into any one deck. */
export const UNIQUE_DISTRICTS: readonly DistrictSpec[] = [
  unique("keep", "Keep", 3),
  unique("laboratory", "Laboratory", 5),
  unique("smithy", "Smithy", 5),
  unique("graveyard", "Graveyard", 5),
  unique("library", "Library", 6),
  unique("school-of-magic", "School of Magic", 6),
  unique("dragon-gate", "Dragon Gate", 6),
  unique("university", "University", 6),
  unique("observatory", "Observatory", 5),
  unique("great-wall", "Great Wall", 6),
  unique("imperial-treasury", "Imperial Treasury", 5),
  unique("wharf", "Wharf", 3),
  unique("thieves-den", "Thieves' Den", 4),
  unique("bell-tower", "Bell Tower", 5),
  unique("factory", "Factory", 5),
  unique("museum", "Museum", 4),
  unique("park", "Park", 6),
  unique("poor-house", "Poor House", 4),
  unique("statue", "Statue", 3),
  unique("theatre", "Theatre", 3),
  unique("haunted-quarter", "Haunted Quarter", 5),
  unique("wishing-well", "Wishing Well", 3),
  unique("ivory-tower", "Ivory Tower", 5),
  unique("quarry", "Quarry", 4),
  unique("ballroom", "Ballroom", 3),
  unique("triumphal-arch", "Triumphal Arch", 6),
  unique("clock-tower", "Clock Tower", 4),
  unique("menagerie", "Menagerie", 4),
  unique("cathedral", "Cathedral", 6),
  unique("scriptorium", "Scriptorium", 6),
];

export const DISTRICT_CATALOG: readonly DistrictSpec[] = [...BASIC_DISTRICTS, ...UNIQUE_DISTRICTS];

/** The Bell Tower widens the finish line: a city of seven ends the game. */
export const BELL_TOWER: DistrictId = "bell-tower";

/** The canonical 14 uniques a game deals unless the setup overrides them. */
export const DEFAULT_UNIQUES: readonly DistrictId[] = [
  "keep",
  "laboratory",
  "smithy",
  "graveyard",
  "library",
  "school-of-magic",
  "dragon-gate",
  "university",
  "observatory",
  "great-wall",
  "bell-tower",
  "factory",
  "museum",
  "park",
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
