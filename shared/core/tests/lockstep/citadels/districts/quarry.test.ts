import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { diplomat } from "../../../../lockstep/games/citadels/characters/diplomat.ts";
import { magistrate } from "../../../../lockstep/games/citadels/characters/magistrate.ts";
import { marshal } from "../../../../lockstep/games/citadels/characters/marshal.ts";
import { specOfDistrict } from "../../../../lockstep/games/citadels/districts.ts";
import {
  quarry,
  quarryScoring,
  quarryTriggers,
} from "../../../../lockstep/games/citadels/districts/quarry.ts";
import { END_TURN, tryBuild } from "../../../../lockstep/games/citadels/helpers.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  rawGenesis,
  rawGold,
  rawHand,
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

test("you may build a district identical to one already in your city", () => {
  const state = turnState(["quarry", "tavern"], ["tavern"], 10);
  const next = advance(state, () => ({ t: "build", card: 0 }));
  // The second tavern is the one permitted duplicate. The build answer gathers 2
  // gold first (commit 64420ca), then pays the Tavern's own cost.
  expect(cityIds(next, ANN)).toEqual(["quarry", "tavern", "tavern"]);
  expect(rawGold(next, ANN)).toBe(10 + 2 - specOfDistrict("tavern").cost);
});

test("only one duplicate may exist: a third identical district is refused", () => {
  const state = turnState(["quarry", "tavern", "tavern"], ["tavern"], 10);
  const next = tryBuild(state, ANN, 0, rawRandom());
  expect(cityIds(next, ANN)).toEqual(["quarry", "tavern", "tavern"]);
  expect(rawHand(next, ANN)).toEqual(["tavern"]);
  expect(rawGold(next, ANN)).toBe(10);
});

test("the base rule forbids a duplicate; the Quarry is what permits one", () => {
  const withQuarry = tryBuild(turnState(["quarry", "tavern"], ["tavern"], 10), ANN, 0, rawRandom());
  const withoutQuarry = tryBuild(turnState(["tavern"], ["tavern"], 10), ANN, 0, rawRandom());
  // The Quarry permits exactly one duplicate; without it the base rule refuses it.
  expect(cityIds(withQuarry, ANN)).toEqual(["quarry", "tavern", "tavern"]);
  expect(cityIds(withoutQuarry, ANN)).toEqual(["tavern"]);
});

test("the Quarry declares the onBuild trigger", () => {
  expect(quarryTriggers).toEqual(["onBuild"]);
});

test("the Quarry's effect is the build query: its hook changes no state", () => {
  const state = turnState(["quarry"], [], 10);
  expect(quarry({ state, owner: ANN, city: rawPlayer(state, ANN).city, rest: [], rng: rawRandom() })).toBe(
    state,
  );
});

// --- the acquisition clause: the Magistrate, Diplomat, and Marshal ---

const withCities = (
  state: CitadelsState,
  mine: readonly string[],
  theirs: readonly string[],
): CitadelsState => withCity(withCity(state, ANN, place(mine)), BOB, place(theirs));

const CAST_MARSHAL: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "marshal",
];

const CAST_DIPLOMAT: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "diplomat",
];

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

const openCast = (cast: readonly CharacterId[], claimed: CitadelsState["claimed"]): CitadelsState => ({
  ...rawGenesis(SEATS3, cast),
  phase: "turn",
  draft: null,
  claimed,
  callRank: 1,
  active: ANN,
  steps: [],
});

/** The first hand card the seat can afford, with its cost. */
const firstAffordable = (
  state: CitadelsState,
  seat: SeatId,
): { readonly index: number; readonly cost: number } => {
  const player = rawPlayer(state, seat);
  for (let index = 0; index < player.hand.length; index += 1) {
    const id = player.hand[index];
    if (id === undefined) continue;
    const cost = specOfDistrict(id).cost;
    if (cost <= player.gold) return { index, cost };
  }
  throw new Error("no affordable card in hand");
};

test("the Marshal cannot seize an identical district from a rival", () => {
  const state = withGold(withCities(openCast(CAST_MARSHAL, []), ["tavern"], ["tavern"]), ANN, 20);
  const opened = marshal({ state, seat: ANN, rest: [], rng: rawRandom() });
  const afterTarget = advance(opened, (seat) => (seat === ANN ? { t: "target", seat: BOB } : null));
  const next = advance(afterTarget, (seat) => (seat === ANN ? { t: "keep", index: 0 } : null));
  expect(next.pending).toBeNull();
  expect(cityIds(next, ANN)).toEqual(["tavern"]);
  expect(cityIds(next, BOB)).toEqual(["tavern"]);
  expect(rawGold(next, ANN)).toBe(20);
});

test("the Diplomat cannot take an identical district from a rival", () => {
  const state = withGold(withCities(openCast(CAST_DIPLOMAT, []), ["tavern", "docks"], ["tavern"]), ANN, 20);
  const opened = diplomat({ state, seat: ANN, rest: [], rng: rawRandom() });
  const afterTarget = advance(opened, (seat) => (seat === ANN ? { t: "target", seat: BOB } : null));
  const next = advance(afterTarget, (seat) => (seat === ANN ? { t: "keep", index: 0 } : null));
  expect(next.pending).toBeNull();
  expect(cityIds(next, ANN)).toEqual(["tavern", "docks"]);
  expect(cityIds(next, BOB)).toEqual(["tavern"]);
});

test("the Magistrate cannot confiscate a district it already holds an identical copy of", () => {
  const base: CitadelsState = {
    ...withGold(
      openCast(CAST_MAGISTRATE, [
        { seat: ANN, character: "merchant" },
        { seat: BOB, character: "magistrate" },
      ]),
      ANN,
      20,
    ),
    warrants: ["merchant", "thief", "architect"],
  };
  const { index } = firstAffordable(base, ANN);
  const builtId = rawPlayer(base, ANN).hand[index];
  const raw = tryBuild(base, ANN, index, rawRandom());
  const built: CitadelsState = { ...raw, steps: [...raw.steps, END_TURN] };
  const withCopy = withCity(built, BOB, place([builtId ?? "tavern"]));
  const seized = advance(withCopy, (seat) => (seat === BOB ? { t: "choose", value: "confiscate" } : null));
  expect(cityIds(seized, ANN)).toContain(builtId);
  expect(cityIds(seized, BOB)).toEqual([builtId]);
});

test("the Quarry scores no extra points on a crafted city", () => {
  const city: readonly PlacedDistrict[] = place(["quarry", "watchtower"]);
  expect(quarryScoring(city[0]!, city, ANN, turnState(["quarry", "watchtower"], [], 0))).toBe(0);
  const state = withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    [...city],
  );
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 4 + 1; the Quarry adds nothing at end of game.
  expect(score?.districts).toBe(5);
  expect(score?.unique).toBe(0);
});
