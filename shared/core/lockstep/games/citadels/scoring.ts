import type { SeatId } from "../../index.ts";
import { specOfDistrict, typeOfPlaced, type DistrictType } from "./districts.ts";
import { UNIQUE_SCORING } from "./districts/effects.ts";
import { playerOf } from "./helpers.ts";
import type { CitadelsState, PlacedDistrict } from "./state.ts";

export interface Score {
  readonly seat: SeatId;
  readonly districts: number;
  readonly colors: number;
  readonly completion: number;
  readonly unique: number;
  readonly total: number;
}

const ALL_TYPES: readonly DistrictType[] = ["noble", "religious", "trade", "military", "unique"];

const costSum = (city: readonly PlacedDistrict[]): number =>
  city.reduce((sum, district) => sum + specOfDistrict(district.id).cost, 0);

/** Three points for a city that shows all five district types. */
const colourBonus = (city: readonly PlacedDistrict[]): number => {
  const present = new Set(city.map((district) => typeOfPlaced(district)));
  return ALL_TYPES.every((type) => present.has(type)) ? 3 : 0;
};

/** Four to the first completed city, two to each other completed city. */
const completionBonus = (state: CitadelsState, seat: SeatId): number => {
  const index = state.completed.indexOf(seat);
  if (index < 0) return 0;
  return index === 0 ? 4 : 2;
};

/** End-game points from unique districts, summed from each district's own file. */
const uniquePoints = (
  state: CitadelsState,
  city: readonly PlacedDistrict[],
  seat: SeatId,
): number =>
  city.reduce((sum, district) => {
    if (!specOfDistrict(district.id).unique) return sum;
    return sum + (UNIQUE_SCORING[district.id]?.(district, city, seat, state) ?? 0);
  }, 0);

export const scoreGame = (state: CitadelsState): readonly Score[] =>
  state.players.map((player): Score => {
    const districts = costSum(player.city);
    const colors = colourBonus(player.city);
    const completion = completionBonus(state, player.seat);
    const unique = uniquePoints(state, player.city, player.seat);
    return {
      seat: player.seat,
      districts,
      colors,
      completion,
      unique,
      total: districts + colors + completion + unique,
    };
  });

/**
 * The winner: highest total, tie-broken by district points, then gold. A tie
 * that survives both tie-breaks has no winner.
 */
export const winnerOf = (state: CitadelsState): SeatId | null => {
  const scores = [...scoreGame(state)];
  if (scores.length === 0) return null;
  const goldOf = (seat: SeatId): number => playerOf(state, seat).gold;
  scores.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.districts !== a.districts) return b.districts - a.districts;
    return goldOf(b.seat) - goldOf(a.seat);
  });
  const top = scores[0];
  if (top === undefined) return null;
  const tied = scores.filter(
    (score) =>
      score.total === top.total &&
      score.districts === top.districts &&
      goldOf(score.seat) === goldOf(top.seat),
  );
  return tied.length === 1 ? top.seat : null;
};
