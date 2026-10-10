import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import { typeOfPlaced } from "../../../../lockstep/games/citadels/districts.ts";
import {
  schoolOfMagic,
  schoolOfMagicScoring,
  schoolOfMagicTriggers,
} from "../../../../lockstep/games/citadels/districts/school-of-magic.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  rawGenesis,
  rawGold,
  rawPlayer,
  rawRandom,
  withGold,
} from "../driver.ts";

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

/** ANN's turn window is open, the given character claimed, and the round closes beneath. */
const turnState = (city: readonly PlacedDistrict[], character: string): CitadelsState =>
  withCity(
    {
      ...rawGenesis(SEATS3, BASE_CAST_IDS),
      phase: "turn",
      draft: null,
      active: ANN,
      claimed: [{ seat: ANN, character: character as never }],
      steps: [
        { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
        { kind: "end-round" },
      ],
    },
    ANN,
    city,
  );

const SCHOOL: PlacedDistrict = { id: "school-of-magic", gold: 0 };

const declaredTypeOf = (state: CitadelsState, seat: SeatId): string | undefined =>
  rawPlayer(state, seat).city.find((district) => district.id === "school-of-magic")?.declaredType;

const ctxFor = (state: CitadelsState) => ({
  state,
  owner: ANN,
  city: rawPlayer(state, ANN).city,
  rest: [],
  rng: rawRandom(),
});

test("during resource gathering it counts as a district of the type its owner's character collects", () => {
  // "As the King it can count as noble, and so on."
  expect(declaredTypeOf(schoolOfMagic(ctxFor(turnState([SCHOOL], "king"))), ANN)).toBe("noble");
  expect(declaredTypeOf(schoolOfMagic(ctxFor(turnState([SCHOOL], "bishop"))), ANN)).toBe("religious");
  expect(declaredTypeOf(schoolOfMagic(ctxFor(turnState([SCHOOL], "merchant"))), ANN)).toBe("trade");
  expect(declaredTypeOf(schoolOfMagic(ctxFor(turnState([SCHOOL], "warlord"))), ANN)).toBe("military");
});

test("the declared type is the one the owner chooses, overriding the character's colour", () => {
  const state: CitadelsState = {
    ...turnState([SCHOOL], "king"),
    pending: {
      actor: ANN,
      character: null,
      target: null,
      namedCharacter: null,
      namedType: "military",
      cards: [],
      gold: 0,
      amount: 0,
      note: null,
    },
  };
  expect(declaredTypeOf(schoolOfMagic(ctxFor(state)), ANN)).toBe("military");
});

test("a character that collects no income leaves the card counting as its catalog type", () => {
  const state = turnState([SCHOOL], "assassin");
  const next = schoolOfMagic(ctxFor(state));
  expect(declaredTypeOf(next, ANN)).toBeUndefined();
  expect(typeOfPlaced(rawPlayer(next, ANN).city[0]!)).toBe("unique");
});

test("the declared type reaches the type readers: the colour count reads it", () => {
  const city: readonly PlacedDistrict[] = [
    { id: "manor", gold: 0 },
    { id: "temple", gold: 0 },
    { id: "tavern", gold: 0 },
    { id: "watchtower", gold: 0 },
    SCHOOL,
  ];
  // Undeclared, the School of Magic is the fifth colour: +3.
  const undeclared = scoreGame(withCity(turnState([...city], "assassin"), ANN, [...city])).find(
    (entry) => entry.seat === ANN,
  );
  expect(undeclared?.colors).toBe(3);
  // Declared noble, its own unique colour drops and only four remain: +0.
  const declaredCity = city.map((district) =>
    district.id === "school-of-magic" ? { ...district, declaredType: "noble" as const } : district,
  );
  const declared = scoreGame(withCity(turnState(declaredCity, "king"), ANN, declaredCity)).find(
    (entry) => entry.seat === ANN,
  );
  expect(declared?.colors).toBe(0);
});

test("the engine fires the declaration on a gather: a gold gather declares the King's colour", () => {
  const state = withGold(turnState([SCHOOL], "king"), ANN, 2);
  const next = advance(state, () => ({ t: "gold" }));
  // The gather paid the base 2 gold and the School of Magic now counts as noble.
  expect(rawGold(next, ANN)).toBe(4);
  expect(declaredTypeOf(next, ANN)).toBe("noble");
});

test("the School of Magic declares the onIncome trigger", () => {
  expect(schoolOfMagicTriggers).toEqual(["onIncome"]);
});

test("the effect is not a no-op: the King's gather leaves the card counting as noble", () => {
  const state = turnState([SCHOOL], "king");
  const before = typeOfPlaced(rawPlayer(state, ANN).city[0]!);
  const after = typeOfPlaced(rawPlayer(schoolOfMagic(ctxFor(state)), ANN).city[0]!);
  expect(before).toBe("unique");
  expect(after).toBe("noble");
  expect(after).not.toBe(before);
});

test("the School of Magic scores no extra points on a crafted city", () => {
  const city: readonly PlacedDistrict[] = [SCHOOL, { id: "watchtower", gold: 0 }];
  expect(schoolOfMagicScoring(city[0]!, city, ANN, turnState([...city], "king"))).toBe(0);
  const state = withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    [...city],
  );
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  // Cost sum only: 6 + 1; the School of Magic adds nothing at end of game.
  expect(score?.districts).toBe(7);
  expect(score?.unique).toBe(0);
});
