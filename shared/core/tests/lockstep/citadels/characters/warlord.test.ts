import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { destroyPrice, warlord } from "../../../../lockstep/games/citadels/characters/warlord.ts";
import type { CitadelsState, Claim, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
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
  "warlord",
];

/** A turn-phase state: the draft is over and the Warlord's rank is armed. */
const turnState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, CAST),
  phase: "turn",
  draft: null,
  claimed: [{ seat: ANN, character: "warlord" }] as readonly Claim[],
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

const withPlaced = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

const openWarlord = (state: CitadelsState): CitadelsState =>
  warlord({ state, seat: ANN, rest: [], rng: rawRandom() });

const pickTarget = (state: CitadelsState, seat: SeatId): CitadelsState =>
  advance(state, (s) => (s === ANN ? { t: "target", seat } : null));

const pickDistrict = (state: CitadelsState, index: number): CitadelsState =>
  advance(state, (s) => (s === ANN ? { t: "keep", index } : null));

const destroy = (state: CitadelsState, seat: SeatId, index: number): CitadelsState =>
  pickDistrict(pickTarget(openWarlord(state), seat), index);

const bottom = (state: CitadelsState): string | undefined => state.deck[state.deck.length - 1];

test("gain 1 gold per military district in your city", () => {
  const state = withCity(turnState(), ANN, ["watchtower", "prison", "barracks", "tavern"]);
  const next = openWarlord(state);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 3);
});

test("you may destroy one district of a rival's by paying one fewer gold than its cost", () => {
  const state = withGold(withCity(turnState(), BOB, ["palace"]), ANN, 20);
  const next = destroy(state, BOB, 0);
  expect(rawGold(next, ANN)).toBe(20 - destroyPrice("palace"));
  expect(rawPlayer(next, BOB).city).toHaveLength(0);
  expect(bottom(next)).toBe("palace");
});

test("you may destroy one district of your own by paying one fewer gold than its cost", () => {
  const state = withGold(withCity(turnState(), ANN, ["docks"]), ANN, 20);
  const next = destroy(state, ANN, 0);
  expect(rawGold(next, ANN)).toBe(20 - destroyPrice("docks"));
  expect(rawPlayer(next, ANN).city).toHaveLength(0);
});

test("destroyed districts go to the bottom of the deck", () => {
  const state = withGold(withCity(turnState(), BOB, ["palace", "castle"]), ANN, 20);
  const sizeBefore = state.deck.length;
  const next = destroy(state, BOB, 0);
  expect(next.deck).toHaveLength(sizeBefore + 1);
  expect(bottom(next)).toBe("palace");
  expect(next.deck[0]).toBe(state.deck[0]);
});

test("you cannot destroy a district in a completed city", () => {
  const eight = ["tavern", "tavern", "tavern", "tavern", "tavern", "tavern", "tavern", "tavern"];
  const state = withGold(withCity(turnState(), BOB, eight), ANN, 20);
  const afterTarget = pickTarget(openWarlord(state), BOB);
  expect(afterTarget.pending).toBeNull();
  expect(openPurpose(afterTarget)).not.toBe("warlord-destroy");
  expect(rawPlayer(afterTarget, BOB).city).toHaveLength(8);
  expect(rawGold(afterTarget, ANN)).toBe(20);
});

test("a beautified district costs one more gold to destroy", () => {
  const state = withGold(withPlaced(turnState(), BOB, [{ id: "tavern", gold: 1 }]), ANN, 20);
  const next = destroy(state, BOB, 0);
  // Tavern costs 1; the Artist's gold marker raises it to 2, less the Warlord's one: 1.
  expect(rawGold(next, ANN)).toBe(20 - destroyPrice("tavern", 1));
  expect(bottom(next)).toBe("tavern");
});

test("declining the destroy leaves every city untouched", () => {
  const state = withGold(withCity(turnState(), BOB, ["palace"]), ANN, 20);
  const declined = advance(openWarlord(state), () => null);
  expect(declined.pending).toBeNull();
  expect(rawPlayer(declined, BOB).city).toHaveLength(1);
  expect(rawGold(declined, ANN)).toBe(20);
  expect(declined.deck).toEqual(state.deck);
});

test("a killed warlord takes no income and opens no window", () => {
  const state: CitadelsState = { ...withCity(turnState(), ANN, ["watchtower"]), skipped: ["warlord"] };
  const next = openWarlord(state);
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN));
  expect(openPurpose(next)).toBeNull();
});

test("the ability is not a no-op: it raises gold and sinks a district", () => {
  const state = withGold(withCity(withCity(turnState(), ANN, ["barracks"]), BOB, ["palace"]), ANN, 20);
  const next = destroy(state, BOB, 0);
  // Income from the barracks (1) plus the destroy payment (4).
  expect(rawGold(next, ANN)).toBe(20 + 1 - destroyPrice("palace"));
  expect(rawPlayer(next, BOB).city).toHaveLength(0);
  expect(bottom(next)).toBe("palace");
  expect(next.deck).not.toEqual(state.deck);
});
