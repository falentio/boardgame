import { expect, test } from "vitest";
import type { SeatId } from "../../../../index.ts";
import { typeOfPlaced, type DistrictType } from "../../../../lockstep/games/citadels/districts.ts";
import {
  hauntedQuarter,
  hauntedQuarterScoring,
  hauntedQuarterTriggers,
} from "../../../../lockstep/games/citadels/districts/haunted-quarter.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import type { CitadelsState, Pending, PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";
import { ANN, BASE_CAST_IDS, SEATS3, rawGenesis, rawPlayer, rawRandom } from "../driver.ts";

const placed = (id: string): PlacedDistrict => ({ id, gold: 0 });

const HAUNTED_QUARTER = "haunted-quarter";

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

/** The owner's choose-type choice, the window shape that carries the declared type. */
const choice = (type: DistrictType): Pending => ({
  actor: ANN,
  character: null,
  target: null,
  namedCharacter: null,
  namedType: type,
  cards: [],
  gold: 0,
  amount: 0,
  note: null,
});

/** ANN's turn phase, a city, and the type choice in flight (null means none recorded). */
const turnState = (
  city: readonly PlacedDistrict[],
  chosen: DistrictType | null,
): CitadelsState =>
  withCity(
    {
      ...rawGenesis(SEATS3, BASE_CAST_IDS),
      phase: "turn",
      draft: null,
      active: ANN,
      pending: chosen === null ? null : choice(chosen),
    },
    ANN,
    city,
  );

const ctxFor = (state: CitadelsState) => ({
  state,
  owner: ANN,
  city: rawPlayer(state, ANN).city,
  rest: [],
  rng: rawRandom(),
});

const declaredTypeOf = (state: CitadelsState, seat: SeatId): DistrictType | undefined =>
  rawPlayer(state, seat).city.find((district) => district.id === HAUNTED_QUARTER)?.declaredType;

/** The four basic colours plus the Haunted Quarter: five colours while it counts as unique. */
const FIVE_COLOURS: readonly PlacedDistrict[] = [
  placed("manor"),
  placed("temple"),
  placed("tavern"),
  placed("watchtower"),
  placed(HAUNTED_QUARTER),
];

test("at final scoring it counts as a district of any one type its owner chooses", () => {
  expect(declaredTypeOf(hauntedQuarter(ctxFor(turnState([placed(HAUNTED_QUARTER)], "noble"))), ANN)).toBe("noble");
  expect(declaredTypeOf(hauntedQuarter(ctxFor(turnState([placed(HAUNTED_QUARTER)], "trade"))), ANN)).toBe("trade");
  expect(declaredTypeOf(hauntedQuarter(ctxFor(turnState([placed(HAUNTED_QUARTER)], "military"))), ANN)).toBe("military");
  expect(declaredTypeOf(hauntedQuarter(ctxFor(turnState([placed(HAUNTED_QUARTER)], "religious"))), ANN)).toBe("religious");
});

test("the chosen type reaches the type readers, so the colour count sees the chosen colour", () => {
  const undeclared = withCity(turnState([...FIVE_COLOURS], null), ANN, [...FIVE_COLOURS]);
  expect(scoreGame(undeclared).find((entry) => entry.seat === ANN)?.colors).toBe(3);

  // Declared noble, the Haunted Quarter supplies the noble colour and its own unique colour drops.
  const chosen = hauntedQuarter(ctxFor(turnState([...FIVE_COLOURS], "noble")));
  const declared = scoreGame(chosen).find((entry) => entry.seat === ANN);
  expect(declared?.colors).toBe(0);
});

test("a type other than unique means it no longer counts as unique for other scoring", () => {
  const declared = hauntedQuarter(ctxFor(turnState([placed(HAUNTED_QUARTER)], "noble")));
  const card = rawPlayer(declared, ANN).city[0]!;
  expect(typeOfPlaced(card)).not.toBe("unique");
  expect(typeOfPlaced(card)).toBe("noble");
  // Choosing unique keeps the unique colour, the rulebook's other branch.
  const kept = hauntedQuarter(ctxFor(turnState([placed(HAUNTED_QUARTER)], "unique")));
  expect(typeOfPlaced(rawPlayer(kept, ANN).city[0]!)).toBe("unique");
});

test("with no type chosen it counts as its catalog type, unique, by default", () => {
  const state = turnState([placed(HAUNTED_QUARTER)], null);
  const next = hauntedQuarter(ctxFor(state));
  expect(declaredTypeOf(next, ANN)).toBeUndefined();
  expect(typeOfPlaced(rawPlayer(next, ANN).city[0]!)).toBe("unique");
});

test("the exact extra points on a crafted city: the Haunted Quarter adds none of its own", () => {
  const state = withCity(turnState([...FIVE_COLOURS], null), ANN, [...FIVE_COLOURS]);
  const ann = scoreGame(state).find((entry) => entry.seat === ANN);
  // Costs: manor 3 + temple 1 + tavern 1 + watchtower 1 + haunted-quarter 5 = 11.
  // Five colours present: +3. The Haunted Quarter's own unique points are zero.
  expect(hauntedQuarterScoring(placed(HAUNTED_QUARTER), [...FIVE_COLOURS], ANN, state)).toBe(0);
  expect(ann?.districts).toBe(11);
  expect(ann?.colors).toBe(3);
  expect(ann?.unique).toBe(0);
  expect(ann?.total).toBe(14);
});

test("the ability is not a no-op: recording a chosen type flips the card's counted type", () => {
  const state = turnState([placed(HAUNTED_QUARTER)], "noble");
  const before = typeOfPlaced(rawPlayer(state, ANN).city[0]!);
  const after = typeOfPlaced(rawPlayer(hauntedQuarter(ctxFor(state)), ANN).city[0]!);
  expect(before).toBe("unique");
  expect(after).toBe("noble");
  expect(after).not.toBe(before);
});

test("the Haunted Quarter declares no engine trigger; the choice is a scoring-time seam", () => {
  expect(hauntedQuarterTriggers).toEqual([]);
});
