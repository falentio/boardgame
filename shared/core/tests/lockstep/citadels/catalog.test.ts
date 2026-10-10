import { expect, test } from "vitest";
import { genesisSeed, makeRandom } from "../../../index.ts";
import {
  CHARACTER_CATALOG,
  charactersOfRank,
  type CharacterId,
  specOfCharacter,
} from "../../../lockstep/games/citadels/characters.ts";
import {
  BASIC_DISTRICTS,
  DEFAULT_UNIQUES,
  UNIQUE_DISTRICTS,
  buildDeck,
  specOfDistrict,
  type DistrictId,
  type DistrictType,
} from "../../../lockstep/games/citadels/districts.ts";

/** name, type, cost, copies — transcribed from docs/design/citadels-catalog.md. */
const BASIC: readonly (readonly [string, string, DistrictType, number, number])[] = [
  ["watchtower", "Watchtower", "military", 1, 3],
  ["prison", "Prison", "military", 2, 3],
  ["barracks", "Barracks", "military", 3, 3],
  ["fortress", "Fortress", "military", 5, 2],
  ["manor", "Manor", "noble", 3, 5],
  ["castle", "Castle", "noble", 4, 4],
  ["palace", "Palace", "noble", 5, 3],
  ["temple", "Temple", "religious", 1, 3],
  ["church", "Church", "religious", 2, 3],
  ["monastery", "Monastery", "religious", 3, 3],
  ["cathedral", "Cathedral", "religious", 5, 2],
  ["tavern", "Tavern", "trade", 1, 5],
  ["market", "Market", "trade", 2, 4],
  ["trading-post", "Trading Post", "trade", 2, 3],
  ["docks", "Docks", "trade", 3, 3],
  ["harbor", "Harbor", "trade", 4, 3],
  ["town-hall", "Town Hall", "trade", 5, 2],
];

/** name, id, cost — transcribed from docs/design/citadels-catalog.md. */
const UNIQUE: readonly (readonly [string, string, number])[] = [
  ["Armory", "armory", 3],
  ["Basilica", "basilica", 6],
  ["Capitol", "capitol", 5],
  ["Dragon Gate", "dragon-gate", 6],
  ["Factory", "factory", 5],
  ["Framework", "framework", 4],
  ["Gold Mine", "gold-mine", 6],
  ["Great Wall", "great-wall", 6],
  ["Haunted Quarter", "haunted-quarter", 5],
  ["Imperial Treasury", "imperial-treasury", 5],
  ["Ivory Tower", "ivory-tower", 5],
  ["Keep", "keep", 3],
  ["Laboratory", "laboratory", 5],
  ["Library", "library", 6],
  ["Map Room", "map-room", 5],
  ["Monument", "monument", 4],
  ["Museum", "museum", 4],
  ["Necropolis", "necropolis", 5],
  ["Observatory", "observatory", 5],
  ["Park", "park", 6],
  ["Poor House", "poor-house", 4],
  ["Quarry", "quarry", 4],
  ["School of Magic", "school-of-magic", 6],
  ["Secret Vault", "secret-vault", 4],
  ["Smithy", "smithy", 5],
  ["Stables", "stables", 4],
  ["Statue", "statue", 3],
  ["Theater", "theater", 3],
  ["Thieves' Den", "thieves-den", 4],
  ["Wishing Well", "wishing-well", 3],
];

test("BASIC_DISTRICTS is the 17-card, 54-copy set transcribed from the catalog", () => {
  expect(BASIC_DISTRICTS).toHaveLength(17);
  expect(BASIC_DISTRICTS.reduce((n, spec) => n + spec.copies, 0)).toBe(54);
  expect(
    BASIC_DISTRICTS.map((spec) => [spec.id, spec.name, spec.type, spec.cost, spec.copies]),
  ).toEqual(BASIC);
});

test("basic copies per type are military 11, noble 12, religious 11, trade 20", () => {
  const copiesByType = new Map<DistrictType, number>();
  for (const spec of BASIC_DISTRICTS) {
    copiesByType.set(spec.type, (copiesByType.get(spec.type) ?? 0) + spec.copies);
  }
  expect(copiesByType.get("military")).toBe(11);
  expect(copiesByType.get("noble")).toBe(12);
  expect(copiesByType.get("religious")).toBe(11);
  expect(copiesByType.get("trade")).toBe(20);
});

test("UNIQUE_DISTRICTS is the 30-card set, one copy each, ids and costs from the catalog", () => {
  expect(UNIQUE_DISTRICTS).toHaveLength(30);
  for (const spec of UNIQUE_DISTRICTS) expect(spec.copies).toBe(1);
  expect(UNIQUE_DISTRICTS.map((spec) => [spec.name, spec.id, spec.cost])).toEqual(UNIQUE);
  expect(UNIQUE_DISTRICTS.map((spec) => spec.id).sort()).toEqual(
    UNIQUE.map(([, id]) => id).sort(),
  );
});

test("no district id or name is duplicated across basic and unique", () => {
  const all = [...BASIC_DISTRICTS, ...UNIQUE_DISTRICTS];
  const ids = all.map((spec) => spec.id);
  const names = all.map((spec) => spec.name);
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(names).size).toBe(names.length);
});

test("buildDeck deals the 54 basic copies plus 14 chosen uniques", () => {
  const rng = makeRandom(genesisSeed("citadels-catalog"));
  const deck = buildDeck(DEFAULT_UNIQUES, rng);
  expect(deck).toHaveLength(54 + 14);
  const basicIds = new Set(BASIC_DISTRICTS.map((spec) => spec.id));
  const basicCopies = deck.filter((id) => basicIds.has(id));
  expect(basicCopies).toHaveLength(54);
  for (const spec of BASIC_DISTRICTS) {
    expect(basicCopies.filter((id) => id === spec.id)).toHaveLength(spec.copies);
  }
  for (const id of DEFAULT_UNIQUES) {
    expect(deck.filter((card) => card === id)).toHaveLength(1);
  }
});

test("DEFAULT_UNIQUES is 14 distinct catalog uniques", () => {
  expect(DEFAULT_UNIQUES).toHaveLength(14);
  expect(new Set(DEFAULT_UNIQUES).size).toBe(14);
  for (const id of DEFAULT_UNIQUES) expect(specOfDistrict(id).unique).toBe(true);
});

const RANK_1_3: readonly (readonly [1 | 2 | 3, readonly CharacterId[]])[] = [
  [1, ["assassin", "witch", "magistrate"]],
  [2, ["thief", "spy", "blackmailer"]],
  [3, ["magician", "wizard", "seer"]],
];

test("charactersOfRank returns exactly the catalog cast for ranks 1, 2, and 3", () => {
  for (const [rank, expected] of RANK_1_3) {
    expect(charactersOfRank(rank)).toEqual(expected);
  }
});

test("every rank 1-9 holds exactly three characters; the catalog has 27", () => {
  expect(CHARACTER_CATALOG).toHaveLength(27);
  for (const rank of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
    expect(charactersOfRank(rank)).toHaveLength(3);
  }
});

test("income expresses a card grant: Patrician and Cardinal take cards, Abbot a choice", () => {
  expect(specOfCharacter("patrician").income).toEqual({ counts: "noble", grants: { kind: "cards" } });
  expect(specOfCharacter("cardinal").income).toEqual({
    counts: "religious",
    grants: { kind: "cards" },
  });
  expect(specOfCharacter("abbot").income).toEqual({
    counts: "religious",
    grants: { kind: "gold-or-cards" },
  });
});

test("gold-income characters count their district colour and grant gold", () => {
  for (const id of ["king", "emperor"] as const) {
    expect(specOfCharacter(id).income).toEqual({ counts: "noble", grants: { kind: "gold" } });
  }
  expect(specOfCharacter("bishop").income).toEqual({
    counts: "religious",
    grants: { kind: "gold" },
  });
  for (const id of ["merchant", "trader"] as const) {
    expect(specOfCharacter(id).income).toEqual({ counts: "trade", grants: { kind: "gold" } });
  }
  for (const id of ["warlord", "diplomat", "marshal"] as const) {
    expect(specOfCharacter(id).income).toEqual({ counts: "military", grants: { kind: "gold" } });
  }
});
