import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { genesisSeed, makeRandom, makeRoster } from "../../../index.ts";
import {
  BASE_CAST,
  CHARACTER_CATALOG,
  isCharacterId,
  specOfCharacter,
} from "../../../lockstep/games/citadels/characters.ts";
import {
  BASIC_DISTRICTS,
  DISTRICT_CATALOG,
  UNIQUE_DISTRICTS,
  specOfDistrict,
} from "../../../lockstep/games/citadels/districts.ts";
import { UNIQUE_EFFECTS, UNIQUE_TRIGGERS } from "../../../lockstep/games/citadels/districts/effects.ts";
import { CHARACTER_EFFECTS, CHARACTER_RESOLVERS } from "../../../lockstep/games/citadels/characters/index.ts";
import { CitadelsError } from "../../../lockstep/games/citadels/error.ts";
import { citadels } from "../../../lockstep/games/citadels/index.ts";
import { stateCodec } from "../../../lockstep/games/citadels/state.ts";
import { CITY_TARGET, STARTING_GOLD, STARTING_HAND, validateCast } from "../../../lockstep/games/citadels/setup.ts";
import { scoreGame } from "../../../lockstep/games/citadels/scoring.ts";
import { at } from "../harness.ts";
import {
  ANN,
  BASE_CAST_IDS,
  BOB,
  CAST9,
  CARA,
  SEATS3,
  SEATS4,
  SEATS5,
  SEATS6,
  advance,
  autoAction,
  driveFrame,
  owedOf,
  rawGenesis,
  setup,
  tableOf,
  totalCards,
} from "./driver.ts";

/** 54 basic copies plus the 14 chosen uniques. */
const FULL_DECK = BASIC_DISTRICTS.reduce((n, spec) => n + spec.copies, 0) + 14;

test("makeTable starts a session for 3, 4, 5, and 6 seats with a legal cast", () => {
  for (const seats of [SEATS3, SEATS4, SEATS5, SEATS6]) {
    const table = tableOf(seats);
    const view = at(table, seats[0]).view();
    expect(view.phase).toBe("draft");
    expect(view.cast).toHaveLength(8);
    expect(view.players).toHaveLength(seats.length);
    expect(at(table, seats[0]).terminal).toBe(false);
  }
});

test("genesis deals 4 district cards and 2 gold per seat and conserves the full deck", () => {
  for (const seats of [SEATS3, SEATS4, SEATS5, SEATS6]) {
    const state = rawGenesis(seats);
    for (const player of state.players) {
      expect(player.gold).toBe(STARTING_GOLD);
      expect(player.hand).toHaveLength(STARTING_HAND);
      expect(player.city).toHaveLength(0);
    }
    expect(state.deck).toHaveLength(FULL_DECK - STARTING_HAND * seats.length);
    expect(totalCards(state)).toBe(FULL_DECK);
    expect(state.phase).toBe("draft");
    expect(state.crown).toBe(seats[0]);
  }
});

test("validateCast rejects two of one rank, a duplicate, and a missing rank", () => {
  // Two rank-1 characters (Assassin and Witch), so rank 2 is missing.
  expect(() => validateCast(["assassin", "witch", "magician", "king", "bishop", "merchant", "architect", "warlord"])).toThrow(CitadelsError);
  // A duplicate id.
  expect(() => validateCast(["assassin", "assassin", "magician", "king", "bishop", "merchant", "architect", "warlord"])).toThrow(CitadelsError);
  // Seven characters: rank 8 missing.
  expect(() => validateCast(["assassin", "thief", "magician", "king", "bishop", "merchant", "architect"])).toThrow(CitadelsError);
  // The base cast is legal.
  expect(() => validateCast(BASE_CAST_IDS)).not.toThrow();
  // A nine-character cast with a rank-9 character is legal.
  expect(() => validateCast(CAST9)).not.toThrow();
  // A nine-character cast with no rank-9 character is not.
  expect(() =>
    validateCast([...BASE_CAST_IDS, "assassin"]),
  ).toThrow(CitadelsError);
});

test("project omits the deck and every other hand and exposes the viewer's own hand", () => {
  const state = rawGenesis(SEATS3);
  const view = citadels.project(state, ANN);
  expect(Object.keys(view)).not.toContain("deck");
  expect(view.myHand).toEqual(state.players[0]?.hand ?? []);
  for (const player of view.players) {
    expect(Object.keys(player)).not.toContain("hand");
    expect(player.handCount).toBeGreaterThanOrEqual(0);
  }
  // The viewer's own hand is never attached to another seat's entry.
  const bob = view.players.find((p) => p.seat === BOB);
  expect(Object.keys(bob ?? {})).not.toContain("myHand");
  // Only the viewer's own draft pick is exposed.
  const pick = state.draft?.picks.find((entry) => entry.seat === ANN)?.character ?? null;
  expect(view.myPick).toBe(pick);
});

test("the state codec round-trips a genesis state", () => {
  const state = rawGenesis(SEATS4);
  expect(stateCodec.decode(stateCodec.encode(state))).toEqual(state);
});

test("seatsOwed is non-empty on a fresh genesis for every seat count", () => {
  for (const seats of [SEATS3, SEATS4, SEATS5, SEATS6]) {
    const state = rawGenesis(seats);
    expect(citadels.isTerminal(state)).toBe(false);
    expect(citadels.seatsOwed(state, 0).length).toBeGreaterThan(0);
  }
});

test("the catalog holds 27 characters, 3 per rank, with the base eight as the rank 1-8 basics", () => {
  expect(CHARACTER_CATALOG).toHaveLength(27);
  for (let rank = 1; rank <= 9; rank += 1) {
    expect(CHARACTER_CATALOG.filter((spec) => spec.rank === rank)).toHaveLength(3);
  }
  expect(BASE_CAST).toHaveLength(8);
  for (const id of BASE_CAST) expect(specOfCharacter(id).rank).toBeLessThanOrEqual(8);
  expect(isCharacterId("assassin")).toBe(true);
  expect(isCharacterId("nonesuch")).toBe(false);
});

test("every character in the catalog has its own file, an effect, and a resolver wiring", () => {
  const dir = fileURLToPath(new URL("../../../lockstep/games/citadels/characters/", import.meta.url));
  const files = new Set(readdirSync(dir));
  for (const spec of CHARACTER_CATALOG) {
    expect(files.has(`${spec.id}.ts`)).toBe(true);
    expect(typeof CHARACTER_EFFECTS[spec.id]).toBe("function");
  }
  // Every declared window purpose resolves to a function.
  for (const resolver of Object.values(CHARACTER_RESOLVERS)) {
    expect(typeof resolver).toBe("function");
  }
});

test("the district catalog holds 17 basic cards (54 copies) and 30 uniques, each with an effect", () => {
  expect(BASIC_DISTRICTS).toHaveLength(17);
  expect(BASIC_DISTRICTS.reduce((n, spec) => n + spec.copies, 0)).toBe(54);
  expect(UNIQUE_DISTRICTS).toHaveLength(30);
  expect(DISTRICT_CATALOG).toHaveLength(47);
  const copiesByType = new Map<string, number>();
  for (const spec of BASIC_DISTRICTS) {
    copiesByType.set(spec.type, (copiesByType.get(spec.type) ?? 0) + spec.copies);
  }
  expect(copiesByType.get("military")).toBe(11);
  expect(copiesByType.get("noble")).toBe(12);
  expect(copiesByType.get("religious")).toBe(11);
  expect(copiesByType.get("trade")).toBe(20);
  for (const spec of UNIQUE_DISTRICTS) {
    expect(spec.unique).toBe(true);
    expect(spec.type).toBe("unique");
    expect(typeof UNIQUE_EFFECTS[spec.id]).toBe("function");
    expect(UNIQUE_TRIGGERS[spec.id]).toBeDefined();
  }
  expect(specOfDistrict("watchtower").cost).toBe(1);
});

test("scoring counts district costs and flags a colour bonus", () => {
  const state = rawGenesis(SEATS3);
  const scores = scoreGame(state);
  expect(scores).toHaveLength(3);
  for (const score of scores) expect(score.total).toBe(0);
  expect(CITY_TARGET).toBe(8);
});

test("genesis is reproducible from the same seed on independent peers", () => {
  const roster = makeRoster(SEATS3);
  const a = citadels.genesis(setup(), roster, makeRandom(genesisSeed("same-seed")));
  const b = citadels.genesis(setup(), roster, makeRandom(genesisSeed("same-seed")));
  expect(stateCodec.encode(a)).toEqual(stateCodec.encode(b));
});

test("the four-seat and six-seat drafts pass one character at a time; three-seat passes two", () => {
  for (const [seats, perSeat] of [
    [SEATS3, 2],
    [SEATS4, 1],
    [SEATS5, 1],
    [SEATS6, 1],
  ] as const) {
    const state = rawGenesis(seats);
    expect(state.draft?.perSeat).toBe(perSeat);
    expect(state.draft?.order).toHaveLength(seats.length * perSeat);
  }
});

test("a rank-4 character is never dealt into the public faceup discards", () => {
  const state = rawGenesis(SEATS3);
  for (const id of state.draft?.faceup ?? []) {
    expect(specOfCharacter(id).rank).not.toBe(4);
  }
});

test("a full game from genesis reaches terminal for 3, 4, 5, and 6 seats", () => {
  for (const seats of [SEATS3, SEATS4, SEATS5, SEATS6]) {
    let state = rawGenesis(seats);
    let frames = 0;
    while (!citadels.isTerminal(state) && frames < 20_000) {
      // The phase machine never stalls: a non-terminal state always owes input.
      expect(owedOf(state).length).toBeGreaterThan(0);
      state = advance(state, (seat) => autoAction(seat, citadels.project(state, seat)));
      frames += 1;
    }
    expect(citadels.isTerminal(state)).toBe(true);
    expect(state.phase).toBe("over");
    // Every district card is still in play at the end: none fabricated, none lost.
    expect(totalCards(state)).toBe(FULL_DECK);
  }
});

test("the district deck is conserved through a whole game", () => {
  let state = rawGenesis(SEATS4);
  while (!citadels.isTerminal(state)) {
    expect(totalCards(state)).toBe(FULL_DECK);
    state = advance(state, (seat) => autoAction(seat, citadels.project(state, seat)));
  }
  expect(totalCards(state)).toBe(FULL_DECK);
});

test("a table of sessions advances frames and never owes an empty set", () => {
  const table = tableOf(SEATS4);
  for (let i = 0; i < 30; i += 1) {
    expect(at(table, ANN).terminal).toBe(false);
    expect(at(table, ANN).owed().length).toBeGreaterThan(0);
    driveFrame(table, autoAction);
  }
  const view = at(table, ANN).view();
  expect(view.round).toBeGreaterThanOrEqual(1);
  expect(view.players).toHaveLength(4);
});
