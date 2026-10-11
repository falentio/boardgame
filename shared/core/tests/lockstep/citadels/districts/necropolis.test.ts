import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import {
  necropolis,
  necropolisScoring,
  necropolisTriggers,
} from "../../../../lockstep/games/citadels/districts/necropolis.ts";
import { END_TURN, tryBuild } from "../../../../lockstep/games/citadels/helpers.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawGold,
  rawPlayer,
  rawRandom,
  totalCards,
  withGold,
  withHand,
} from "../driver.ts";

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

const cityIds = (state: CitadelsState, seat: SeatId): readonly string[] =>
  rawPlayer(state, seat).city.map((district) => district.id);

const place = (ids: readonly string[]): readonly PlacedDistrict[] =>
  ids.map((id) => ({ id, gold: 0 }));

/** ANN's turn window is open, her city and hand stand as given, and the round closes below. */
const turnState = (
  city: readonly string[],
  hand: readonly string[],
  gold: number,
): CitadelsState =>
  withGold(
    withHand(
      withCity(
        {
          ...rawGenesis(SEATS3, BASE_CAST_IDS),
          phase: "turn",
          draft: null,
          active: ANN,
          steps: [
            { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
            { kind: "end-round" },
          ],
        },
        ANN,
        place(city),
      ),
      ANN,
      hand,
    ),
    ANN,
    gold,
  );

const build = (state: CitadelsState, card = 0): CitadelsState =>
  advance(state, () => ({ t: "build", card }));

test("instead of paying the Necropolis's cost, you destroy a district in your city", () => {
  const state = turnState(["tavern", "watchtower"], ["necropolis"], 10);
  const next = build(state);
  // The first district is spent, the Necropolis rises in its place, no gold paid.
  expect(cityIds(next, ANN)).toEqual(["watchtower", "necropolis"]);
  expect(specOfDistrict("necropolis").cost).toBe(5);
  // The turn gathers 2 gold (commit 64420ca: a turn gathers, then optionally
  // builds); the destroy trade pays none of the Necropolis's cost.
  expect(rawGold(next, ANN)).toBe(10 + 2);
  // The destroyed district sinks to the bottom of the deck, as the Warlord does.
  expect(next.deck[next.deck.length - 1]).toBe("tavern");
  expect(totalCards(next)).toBe(totalCards(state));
});

test("the Necropolis may destroy any one district: the other districts are untouched", () => {
  const state = turnState(["watchtower", "tavern", "docks"], ["necropolis"], 10);
  const next = build(state);
  expect(cityIds(next, ANN)).toEqual(["tavern", "docks", "necropolis"]);
  expect(cityIds(next, ANN)).not.toContain("watchtower");
  // The turn gathered 2 gold; the destroy trade pays nothing.
  expect(rawGold(next, ANN)).toBe(10 + 2);
});

test("with no district to destroy the Necropolis is not buildable by destruction", () => {
  // The destroy trade needs a district in the city; an empty city pays the cost.
  const state = turnState([], ["necropolis"], 10);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityIds(next, ANN)).toEqual(["necropolis"]);
  expect(rawGold(next, ANN)).toBe(10 - specOfDistrict("necropolis").cost);
});

test("a Necropolis already in the city does not price a later build", () => {
  const state = turnState(["necropolis"], ["tavern"], 10);
  const next = build(state);
  // The tavern pays its own catalog cost; the standing Necropolis is not consumed.
  expect(cityIds(next, ANN)).toEqual(["necropolis", "tavern"]);
  // The gather's 2 gold, then the Tavern's own cost; the standing Necropolis is
  // not consumed.
  expect(rawGold(next, ANN)).toBe(10 + 2 - specOfDistrict("tavern").cost);
});

test("the Necropolis declares the onBuild trigger", () => {
  expect(necropolisTriggers).toEqual(["onBuild"]);
});

test("the Necropolis's effect is the build query: its hook changes no state", () => {
  const state = turnState(["tavern"], [], 10);
  expect(necropolis({ state, owner: ANN, city: rawPlayer(state, ANN).city, rest: [], rng: rawRandom() })).toBe(
    state,
  );
});

test("the ability is not a no-op: a paid Necropolis build leaves the city and stash untouched", () => {
  const paid = build(turnState([], ["necropolis"], 10));
  const destroyed = build(turnState(["tavern"], ["necropolis"], 10));
  // Both turns gathered 2 gold (64420ca); the paid build also pays the cost, the
  // destroy trade does not.
  expect(rawGold(paid, ANN)).toBe(10 + 2 - specOfDistrict("necropolis").cost);
  expect(rawGold(destroyed, ANN)).toBe(10 + 2);
  expect(cityIds(paid, ANN)).toEqual(["necropolis"]);
  expect(cityIds(destroyed, ANN)).toEqual(["necropolis"]);
});

// --- the Magistrate clause ---

const CAST_MAGISTRATE: readonly CharacterId[] = [
  "magistrate",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

const magistrateState = (city: readonly string[], hand: readonly string[]): CitadelsState =>
  withGold(
    withHand(
      withCity(
        {
          ...rawGenesis(SEATS3, CAST_MAGISTRATE),
          phase: "turn",
          draft: null,
          claimed: [
            { seat: ANN, character: "merchant" },
            { seat: BOB, character: "magistrate" },
          ],
          callRank: 1,
          active: ANN,
          steps: [{ kind: "call" }, { kind: "end-round" }],
          warrants: ["merchant", "thief", "architect"],
        },
        ANN,
        place(city),
      ),
      ANN,
      hand,
    ),
    ANN,
    20,
  );

test("the Magistrate cannot confiscate a Necropolis built without paying its cost", () => {
  const state = magistrateState(["tavern"], ["necropolis"]);
  const raw = tryBuild(state, ANN, 0, rawRandom());
  const built: CitadelsState = { ...raw, steps: [...raw.steps, END_TURN] };
  expect(cityIds(built, ANN)).toEqual(["necropolis"]);
  // No gold was paid, so no confiscation window opens for the Magistrate.
  expect(openPurpose(built)).not.toBe("magistrate-confiscate");
  expect(
    built.steps.some((step) => step.kind === "window" && step.window.purpose === "magistrate-confiscate"),
  ).toBe(false);
});

test("a gold-paid Necropolis build by the same warranted player does open the confiscation window", () => {
  const state = magistrateState([], ["necropolis"]);
  const raw = tryBuild(state, ANN, 0, rawRandom());
  const built: CitadelsState = { ...raw, steps: [...raw.steps, END_TURN] };
  expect(openPurpose(built)).toBe("magistrate-confiscate");
});

test("the Necropolis scores no extra points on a crafted city", () => {
  const city: readonly PlacedDistrict[] = place(["necropolis", "watchtower"]);
  expect(necropolisScoring(city[0]!, city, ANN, turnState(["necropolis", "watchtower"], [], 0))).toBe(0);
  const state = withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    [...city],
  );
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 5 + 1; the Necropolis adds nothing at end of game.
  expect(score?.districts).toBe(6);
  expect(score?.unique).toBe(0);
});
