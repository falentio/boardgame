import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import {
  stables,
  stablesScoring,
  stablesTriggers,
} from "../../../../lockstep/games/citadels/districts/stables.ts";
import { tryBuild } from "../../../../lockstep/games/citadels/helpers.ts";
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

test("building the Stables does not count toward the building limit this turn", () => {
  const built = tryBuild(turnState([], ["stables"], 10), ANN, 0, rawRandom());
  expect(cityIds(built, ANN)).toEqual(["stables"]);
  expect(built.builtThisTurn).toBe(0);
});

test("a normal district does count toward the building limit", () => {
  const built = tryBuild(turnState([], ["tavern"], 10), ANN, 0, rawRandom());
  expect(cityIds(built, ANN)).toEqual(["tavern"]);
  expect(built.builtThisTurn).toBe(1);
});

test("after building the Stables you may build another district", () => {
  const state = turnState([], ["stables", "tavern"], 10);
  const first = build(state);
  expect(cityIds(first, ANN)).toEqual(["stables"]);
  // The limit is unspent, so the turn window reopens.
  expect(openPurpose(first)).toBe("turn");
  const second = build(first);
  expect(cityIds(second, ANN)).toEqual(["stables", "tavern"]);
  // The second build spends the allowance and closes the turn.
  expect(openPurpose(second)).not.toBe("turn");
});

test("a normal district consumes the limit: no second build follows", () => {
  const state = turnState([], ["tavern", "market"], 10);
  const first = build(state);
  expect(cityIds(first, ANN)).toEqual(["tavern"]);
  const second = build(first);
  expect(cityIds(second, ANN)).toEqual(["tavern"]);
  expect(cityIds(second, ANN)).not.toContain("market");
});

test("a Stables already in the city does not free a later build", () => {
  const state = turnState(["stables"], ["tavern", "market"], 10);
  const first = build(state);
  expect(cityIds(first, ANN)).toEqual(["stables", "tavern"]);
  const second = build(first);
  expect(cityIds(second, ANN)).toEqual(["stables", "tavern"]);
});

test("the Stables declares the onBuild trigger", () => {
  expect(stablesTriggers).toEqual(["onBuild"]);
});

test("the Stables' effect is the build query: its hook changes no state", () => {
  const state = turnState([], [], 10);
  expect(stables({ state, owner: ANN, city: rawPlayer(state, ANN).city, rest: [], rng: rawRandom() })).toBe(
    state,
  );
});

test("the ability is not a no-op: only the Stables build leaves a second turn window", () => {
  const withStables = build(turnState([], ["stables", "tavern"], 10));
  const withTavern = build(turnState([], ["tavern", "market"], 10));
  expect(openPurpose(withStables)).toBe("turn");
  expect(openPurpose(withTavern)).not.toBe("turn");
  expect(withStables.builtThisTurn).toBe(0);
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

/** ANN's turn window is open with the Magistrate's warrant signed on her character. */
const magistrateTurn = (hand: readonly string[]): CitadelsState =>
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
          steps: [
            { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
            { kind: "end-round" },
          ],
          warrants: ["merchant", "thief", "architect"],
        },
        ANN,
        [],
      ),
      ANN,
      hand,
    ),
    ANN,
    20,
  );

test("a paid Stables build opens the confiscation window for the Magistrate", () => {
  const built = tryBuild(magistrateTurn(["stables"]), ANN, 0, rawRandom());
  expect(cityIds(built, ANN)).toEqual(["stables"]);
  expect(openPurpose(built)).toBe("magistrate-confiscate");
});

test("if the Magistrate confiscates the Stables, you may still build another district", () => {
  const state = magistrateTurn(["stables", "tavern"]);
  const built = build(state);
  expect(openPurpose(built)).toBe("magistrate-confiscate");
  const seized = advance(built, (seat) => (seat === BOB ? { t: "choose", value: "confiscate" } : null));
  // The Stables left ANN's city and never spent her build: the turn window is open.
  expect(cityIds(seized, ANN)).toEqual([]);
  expect(cityIds(seized, BOB)).toEqual(["stables"]);
  expect(seized.builtThisTurn).toBe(0);
  expect(openPurpose(seized)).toBe("turn");
  const second = advance(seized, () => ({ t: "build", card: 0 }));
  expect(cityIds(second, ANN)).toEqual(["tavern"]);
});

test("the Stables score no extra points on a crafted city", () => {
  const city: readonly PlacedDistrict[] = place(["stables", "watchtower"]);
  expect(stablesScoring(city[0]!, city, ANN, turnState(["stables", "watchtower"], [], 0))).toBe(0);
  const state = withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    [...city],
  );
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 4 + 1; the Stables add nothing at end of game.
  expect(score?.districts).toBe(5);
  expect(score?.unique).toBe(0);
  expect(specOfDistrict("stables").cost).toBe(4);
});
