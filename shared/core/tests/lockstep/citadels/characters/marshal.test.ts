import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import {
  isSeizable,
  marshal,
  SEIZE_CEILING,
  seizePrice,
} from "../../../../lockstep/games/citadels/characters/marshal.ts";
import type { CitadelsState, Claim } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawGold,
  rawPlayer,
  rawRandom,
  withGold,
} from "../driver.ts";

const CAST: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "marshal",
];

/** A turn-phase state: the draft is over and the Marshal's rank is armed. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, CAST),
  phase: "turn",
  draft: null,
  claimed: [{ seat: ANN, character: "marshal" }] as readonly Claim[],
  callRank: 1,
  active: ANN,
  steps: [],
});

const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

const cities = (state: CitadelsState, mine: readonly string[], theirs: readonly string[]) =>
  withCity(withCity(state, ANN, mine), BOB, theirs);

const openMarshal = (state: CitadelsState): CitadelsState =>
  marshal({ state, seat: ANN, rest: [], rng: rawRandom() });

const pickTarget = (state: CitadelsState, seat: SeatId): CitadelsState =>
  advance(state, (s) => (s === ANN ? { t: "target", seat } : null));

const pick = (state: CitadelsState, index: number): CitadelsState =>
  advance(state, (s) => (s === ANN ? { t: "keep", index } : null));

const seize = (state: CitadelsState, index: number): CitadelsState =>
  pick(pickTarget(openMarshal(state), BOB), index);

const cityIds = (state: CitadelsState, seat: SeatId): readonly string[] =>
  rawPlayer(state, seat).city.map((district) => district.id);

test("gain 1 gold per military district in your city", () => {
  const state = cities(turnState(), ["watchtower", "prison", "barracks", "tavern"], ["docks"]);
  const next = openMarshal(state);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 3);
});

test("seize one district costing three or less from another player's city", () => {
  const state = withGold(cities(turnState(), [], ["barracks"]), ANN, 20);
  const next = seize(state, 0);
  expect(cityIds(next, ANN)).toEqual(["barracks"]);
  expect(cityIds(next, BOB)).toEqual([]);
});

test("pay the owner gold equal to the seized district's cost", () => {
  const state = withGold(cities(turnState(), [], ["barracks"]), ANN, 20);
  expect(seizePrice("barracks")).toBe(3);
  const next = seize(state, 0);
  expect(rawGold(next, ANN)).toBe(20 - seizePrice("barracks"));
  expect(rawGold(next, BOB)).toBe(rawGold(state, BOB) + seizePrice("barracks"));
});

test("you cannot seize a district costing more than three", () => {
  const state = withGold(cities(turnState(), [], ["castle"]), ANN, 20);
  expect(isSeizable("castle")).toBe(false);
  const next = pick(pickTarget(openMarshal(state), BOB), 0);
  expect(next.pending).toBeNull();
  expect(cityIds(next, ANN)).toEqual([]);
  expect(cityIds(next, BOB)).toEqual(["castle"]);
  expect(rawGold(next, ANN)).toBe(20);
});

test("you cannot seize from a completed city", () => {
  const eight = ["tavern", "tavern", "tavern", "tavern", "tavern", "tavern", "tavern", "tavern"];
  const state = withGold(cities(turnState(), [], eight), ANN, 20);
  const afterTarget = pickTarget(openMarshal(state), BOB);
  expect(afterTarget.pending).toBeNull();
  expect(openPurpose(afterTarget)).not.toBe("marshal-seize");
  expect(cityIds(afterTarget, BOB)).toHaveLength(8);
  expect(rawGold(afterTarget, ANN)).toBe(20);
});

test("you cannot seize a district identical to one you already have", () => {
  const state = withGold(cities(turnState(), ["tavern"], ["tavern"]), ANN, 20);
  const next = pick(pickTarget(openMarshal(state), BOB), 0);
  expect(next.pending).toBeNull();
  expect(cityIds(next, ANN)).toEqual(["tavern"]);
  expect(cityIds(next, BOB)).toEqual(["tavern"]);
  expect(rawGold(next, ANN)).toBe(20);
});

test("a district at exactly the three-gold ceiling is seizable", () => {
  const state = withGold(cities(turnState(), [], ["docks"]), ANN, 20);
  expect(seizePrice("docks")).toBe(SEIZE_CEILING);
  const next = seize(state, 0);
  expect(cityIds(next, ANN)).toEqual(["docks"]);
  expect(rawGold(next, BOB)).toBe(rawGold(state, BOB) + SEIZE_CEILING);
});

test("declining the seize leaves every city and stash untouched", () => {
  const state = withGold(cities(turnState(), [], ["barracks"]), ANN, 20);
  const declined = advance(openMarshal(state), () => null);
  expect(declined.pending).toBeNull();
  expect(cityIds(declined, BOB)).toEqual(["barracks"]);
  expect(rawGold(declined, ANN)).toBe(20);
  expect(rawGold(declined, BOB)).toBe(rawGold(state, BOB));
});

test("the ability is not a no-op: it raises gold and moves a district", () => {
  const state = withGold(cities(turnState(), ["barracks"], ["tavern"]), ANN, 20);
  const next = seize(state, 0);
  // Income from the barracks (1); the tavern (1) is seized for its cost.
  expect(rawGold(next, ANN)).toBe(20 + 1 - seizePrice("tavern"));
  expect(cityIds(next, ANN)).toEqual(["barracks", "tavern"]);
  expect(cityIds(next, BOB)).toEqual([]);
  expect(rawGold(next, BOB)).toBe(rawGold(state, BOB) + seizePrice("tavern"));
});
