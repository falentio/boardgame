import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { diplomat, exchangeCost } from "../../../../lockstep/games/citadels/characters/diplomat.ts";
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
  "diplomat",
];

/** A turn-phase state: the draft is over and the Diplomat's rank is armed. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, CAST),
  phase: "turn",
  draft: null,
  claimed: [{ seat: ANN, character: "diplomat" }] as readonly Claim[],
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

const openDiplomat = (state: CitadelsState): CitadelsState =>
  diplomat({ state, seat: ANN, rest: [], rng: rawRandom() });

const pickTarget = (state: CitadelsState, seat: SeatId): CitadelsState =>
  advance(state, (s) => (s === ANN ? { t: "target", seat } : null));

const pick = (state: CitadelsState, index: number): CitadelsState =>
  advance(state, (s) => (s === ANN ? { t: "keep", index } : null));

const exchange = (state: CitadelsState, theirs: number, mine: number): CitadelsState =>
  pick(pick(pickTarget(openDiplomat(state), BOB), theirs), mine);

const cityIds = (state: CitadelsState, seat: SeatId): readonly string[] =>
  rawPlayer(state, seat).city.map((district) => district.id);

test("gain 1 gold per military district in your city", () => {
  const state = cities(turnState(), ["watchtower", "prison", "barracks", "tavern"], ["docks"]);
  const next = openDiplomat(state);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 3);
});

test("you may exchange one district in another player's city for one in yours", () => {
  const state = withGold(cities(turnState(), ["tavern"], ["docks"]), ANN, 20);
  const next = exchange(state, 0, 0);
  expect(cityIds(next, ANN)).toEqual(["docks"]);
  expect(cityIds(next, BOB)).toEqual(["tavern"]);
  expect(openPurpose(next)).not.toBe("diplomat-exchange");
});

test("pay the difference when the rival's district costs more", () => {
  const state = withGold(cities(turnState(), ["tavern"], ["palace"]), ANN, 20);
  expect(exchangeCost("palace", "tavern")).toBe(4);
  const next = exchange(state, 0, 0);
  expect(rawGold(next, ANN)).toBe(20 - exchangeCost("palace", "tavern"));
  expect(cityIds(next, ANN)).toEqual(["palace"]);
});

test("pay nothing when your district costs the same or more", () => {
  const state = withGold(cities(turnState(), ["palace"], ["tavern"]), ANN, 20);
  expect(exchangeCost("tavern", "palace")).toBe(0);
  const next = exchange(state, 0, 0);
  expect(rawGold(next, ANN)).toBe(20);
  expect(cityIds(next, ANN)).toEqual(["tavern"]);
  expect(cityIds(next, BOB)).toEqual(["palace"]);
});

test("you cannot take from a completed city", () => {
  const eight = ["tavern", "tavern", "tavern", "tavern", "tavern", "tavern", "tavern", "tavern"];
  const state = withGold(cities(turnState(), ["docks"], eight), ANN, 20);
  const afterTarget = pickTarget(openDiplomat(state), BOB);
  expect(afterTarget.pending).toBeNull();
  expect(openPurpose(afterTarget)).not.toBe("diplomat-exchange");
  expect(cityIds(afterTarget, ANN)).toEqual(["docks"]);
  expect(rawGold(afterTarget, ANN)).toBe(20);
});

test("you cannot take a district identical to one you already have", () => {
  const state = withGold(cities(turnState(), ["tavern", "docks"], ["tavern"]), ANN, 20);
  const next = pick(pickTarget(openDiplomat(state), BOB), 0);
  // The taken tavern would duplicate the Diplomat's own tavern: the window closes.
  expect(next.pending).toBeNull();
  expect(openPurpose(next)).not.toBe("diplomat-exchange");
  expect(cityIds(next, ANN)).toEqual(["tavern", "docks"]);
  expect(cityIds(next, BOB)).toEqual(["tavern"]);
});

test("the district you give must not be identical to one they already have", () => {
  const state = withGold(cities(turnState(), ["docks"], ["palace", "docks"]), ANN, 20);
  const afterTake = pick(pickTarget(openDiplomat(state), BOB), 0);
  expect(openPurpose(afterTake)).toBe("diplomat-exchange");
  const next = pick(afterTake, 0);
  // Giving docks back would duplicate the rival's remaining docks: the window closes.
  expect(next.pending).toBeNull();
  expect(cityIds(next, ANN)).toEqual(["docks"]);
  expect(cityIds(next, BOB)).toEqual(["palace", "docks"]);
});

test("declining the exchange leaves both cities untouched", () => {
  const state = withGold(cities(turnState(), ["tavern"], ["docks"]), ANN, 20);
  const declined = advance(openDiplomat(state), () => null);
  expect(declined.pending).toBeNull();
  expect(cityIds(declined, ANN)).toEqual(["tavern"]);
  expect(cityIds(declined, BOB)).toEqual(["docks"]);
  expect(rawGold(declined, ANN)).toBe(20);
});

test("the ability is not a no-op: it raises gold and swaps a district", () => {
  const state = withGold(cities(turnState(), ["barracks"], ["palace"]), ANN, 20);
  const next = exchange(state, 0, 0);
  // Income from the barracks (1) plus the exchange difference (palace 5 - barracks 3).
  expect(rawGold(next, ANN)).toBe(20 + 1 - exchangeCost("palace", "barracks"));
  expect(cityIds(next, ANN)).toEqual(["palace"]);
  expect(cityIds(next, BOB)).toEqual(["barracks"]);
});
