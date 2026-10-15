import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import {
  armory,
  armoryScoring,
  armoryTriggers,
} from "../../../../lockstep/games/citadels/districts/armory.ts";
import type { CitadelsState, Claim } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawPlayer,
  rawRandom,
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

/** A turn-phase state with the Armory standing in ANN's city and rank 8 armed. */
const turnState = (mine: readonly string[], theirs: readonly string[]): CitadelsState => {
  const base = rawGenesis(SEATS3, CAST);
  return {
    ...base,
    phase: "turn",
    draft: null,
    claimed: [{ seat: ANN, character: "warlord" }] as readonly Claim[],
    callRank: 1,
    active: ANN,
    steps: [],
    players: base.players.map((player) => {
      if (player.seat === ANN) {
        return { ...player, city: mine.map((id) => ({ id, gold: 0 })) };
      }
      if (player.seat === BOB) {
        return { ...player, city: theirs.map((id) => ({ id, gold: 0 })) };
      }
      return player;
    }),
  };
};

const openArmory = (state: CitadelsState): CitadelsState => {
  const player = rawPlayer(state, ANN);
  return armory({ state, owner: ANN, city: player.city, rest: [], rng: rawRandom() });
};

const pickTarget = (state: CitadelsState, seat: SeatId): CitadelsState =>
  advance(state, (s) => (s === ANN ? { t: "target", seat } : null));

const pickDistrict = (state: CitadelsState, index: number): CitadelsState =>
  advance(state, (s) => (s === ANN ? { t: "keep", index } : null));

const destroy = (state: CitadelsState, seat: SeatId, index: number): CitadelsState =>
  pickDistrict(pickTarget(openArmory(state), seat), index);

const cityIds = (state: CitadelsState, seat: SeatId): readonly string[] =>
  rawPlayer(state, seat).city.map((district) => district.id);

const deckTail = (state: CitadelsState, n: number): readonly string[] =>
  state.deck.slice(state.deck.length - n);

test("on your turn you may destroy the Armory to destroy one other player's district", () => {
  const state = turnState(["armory", "tavern"], ["palace"]);
  const next = destroy(state, BOB, 0);
  // Both the Armory and the destroyed Palace leave their cities.
  expect(cityIds(next, ANN)).toEqual(["tavern"]);
  expect(cityIds(next, BOB)).toEqual([]);
  // Both sink to the bottom of the deck, the Armory first then the destroyed card.
  expect(deckTail(next, 2)).toEqual(["armory", "palace"]);
});

test("the Armory's destroy opens the armory-destroy window owed by its owner", () => {
  const state = turnState(["armory"], ["palace"]);
  const opened = openArmory(state);
  expect(openPurpose(opened)).toBe("armory-destroy");
  const top = opened.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no window");
  expect(top.window.seats).toEqual([ANN]);
});

test("the Armory may not destroy its owner's own district", () => {
  const state = turnState(["armory", "tavern"], []);
  const afterTarget = pickTarget(openArmory(state), ANN);
  // Naming your own seat is illegal: the window closes with every city untouched.
  expect(afterTarget.pending).toBeNull();
  expect(openPurpose(afterTarget)).not.toBe("armory-destroy");
  expect(cityIds(afterTarget, ANN)).toEqual(["armory", "tavern"]);
});

test("a district in a completed city cannot be destroyed", () => {
  const eight = [
    "tavern",
    "tavern",
    "tavern",
    "tavern",
    "tavern",
    "tavern",
    "tavern",
    "tavern",
  ];
  const state = turnState(["armory", "tavern"], eight);
  const afterTarget = pickTarget(openArmory(state), BOB);
  expect(afterTarget.pending).toBeNull();
  expect(openPurpose(afterTarget)).not.toBe("armory-destroy");
  expect(cityIds(afterTarget, BOB)).toHaveLength(8);
  expect(cityIds(afterTarget, ANN)).toEqual(["armory", "tavern"]);
});

test("the ability is not a no-op: the Armory and a rival district both leave the board", () => {
  const state = turnState(["armory"], ["palace"]);
  const next = destroy(state, BOB, 0);
  expect(next.players).not.toEqual(state.players);
  expect(next.deck).not.toEqual(state.deck);
  expect(cityIds(next, ANN)).not.toContain("armory");
  expect(cityIds(next, BOB)).not.toContain("palace");
});

test("declining the destroy leaves every city and the deck untouched", () => {
  const state = turnState(["armory"], ["palace"]);
  const declined = advance(openArmory(state), () => null);
  expect(declined.pending).toBeNull();
  expect(cityIds(declined, ANN)).toEqual(["armory"]);
  expect(cityIds(declined, BOB)).toEqual(["palace"]);
  expect(declined.deck).toEqual(state.deck);
});

test("the Armory declares the onDestroy hook the engine consults", () => {
  expect(armoryTriggers).toEqual(["onDestroy"]);
});

test("the Armory scores no extra points of its own on a crafted city", () => {
  const state = turnState(["armory", "palace"], []);
  const city = rawPlayer(state, ANN).city;
  const placed = city[0];
  if (placed === undefined) throw new Error("no armory placed");
  expect(armoryScoring(placed, city, ANN, state)).toBe(0);
  expect(specOfDistrict("armory").cost).toBe(3);
});
