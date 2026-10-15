import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import {
  framework,
  frameworkScoring,
  frameworkTriggers,
} from "../../../../lockstep/games/citadels/districts/framework.ts";
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

test("you may build any district by destroying the Framework instead of paying its cost", () => {
  const state = turnState(["framework"], ["dragon-gate"], 10);
  const next = build(state);
  expect(cityIds(next, ANN)).toEqual(["dragon-gate"]);
  // Dragon Gate lists at 6, but the Framework paid for it: no gold left the stash.
  expect(specOfDistrict("dragon-gate").cost).toBe(6);
  // The turn gathers 2 gold (commit 64420ca); the Framework pays the Dragon Gate's
  // cost, so no gold left the stash for it.
  expect(rawGold(next, ANN)).toBe(10 + 2);
  // The destroyed Framework sinks to the bottom of the deck, as the Warlord does.
  expect(next.deck[next.deck.length - 1]).toBe("framework");
});

test("the Framework pays for a basic district too, not only a unique", () => {
  const state = turnState(["framework"], ["castle"], 10);
  const next = build(state);
  expect(cityIds(next, ANN)).toEqual(["castle"]);
  // The gathered 2 gold, none of the Castle's cost: the Framework paid it.
  expect(rawGold(next, ANN)).toBe(10 + 2);
});

test("without the Framework the same build charges its catalog cost", () => {
  const withFramework = build(turnState(["framework"], ["dragon-gate"], 10));
  const withoutFramework = build(turnState([], ["dragon-gate"], 10));
  expect(rawGold(withFramework, ANN) - rawGold(withoutFramework, ANN)).toBe(6);
});

test("building the Framework itself pays its cost: the destroy needs a Framework already in the city", () => {
  const state = turnState([], ["framework"], 10);
  const next = build(state);
  expect(cityIds(next, ANN)).toEqual(["framework"]);
  // No Framework stands to destroy, so the build gathers 2 and pays the cost.
  expect(rawGold(next, ANN)).toBe(10 + 2 - specOfDistrict("framework").cost);
});

test("the Framework declares the onBuild trigger", () => {
  expect(frameworkTriggers).toEqual(["onBuild"]);
});

test("the Framework's effect is the build query: its hook changes no state", () => {
  const state = turnState(["framework"], [], 10);
  expect(framework({ state, owner: ANN, city: rawPlayer(state, ANN).city, rest: [], rng: rawRandom() })).toBe(
    state,
  );
});

test("the ability is not a no-op: the Framework build spends no gold and moves the card to the deck", () => {
  const state = turnState(["framework"], ["palace"], 10);
  const next = build(state);
  // The turn gathers 2 gold and the Framework pays the Palace's cost, so the
  // stash ends exactly 2 richer.
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 2);
  expect(cityIds(next, ANN)).toEqual(["palace"]);
  expect(next.deck).toContain("framework");
  expect(rawPlayer(next, ANN).city.some((district) => district.id === "framework")).toBe(false);
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

test("the Magistrate cannot confiscate a district built by destroying the Framework", () => {
  const state = magistrateState(["framework"], ["dragon-gate"]);
  const raw = tryBuild(state, ANN, 0, rawRandom());
  const built: CitadelsState = { ...raw, steps: [...raw.steps, END_TURN] };
  expect(cityIds(built, ANN)).toEqual(["dragon-gate"]);
  // No gold was paid, so no confiscation window opens for the Magistrate.
  expect(openPurpose(built)).not.toBe("magistrate-confiscate");
  expect(
    built.steps.some((step) => step.kind === "window" && step.window.purpose === "magistrate-confiscate"),
  ).toBe(false);
});

test("a gold-paid build by the same warranted player does open the confiscation window", () => {
  const state = magistrateState([], ["dragon-gate"]);
  const raw = tryBuild(state, ANN, 0, rawRandom());
  const built: CitadelsState = { ...raw, steps: [...raw.steps, END_TURN] };
  expect(openPurpose(built)).toBe("magistrate-confiscate");
});

test("the Framework scores no extra points on a crafted city", () => {
  const city: readonly PlacedDistrict[] = place(["framework", "watchtower"]);
  expect(frameworkScoring(city[0]!, city, ANN, turnState(["framework", "watchtower"], [], 0))).toBe(0);
  const state = withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    [...city],
  );
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 4 + 1; the Framework adds nothing at end of game.
  expect(score?.districts).toBe(5);
  expect(score?.unique).toBe(0);
});
