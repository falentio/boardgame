import type { SeatId } from "../../index.ts";
import { specOfDistrict, typeOfPlaced, type DistrictType } from "./districts.ts";
import { UNIQUE_SCORING } from "./districts/effects.ts";
import { HAND_SCORED_UNIQUES } from "./districts/secret-vault.ts";
import { characterRank, playerOf } from "./helpers.ts";
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

/** The catalog cost plus the Artist's beautify marker, which permanently raises the cost by one. */
const costSum = (city: readonly PlacedDistrict[]): number =>
  city.reduce((sum, district) => sum + specOfDistrict(district.id).cost + district.gold, 0);

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

/**
 * End-game points from unique districts. A unique standing in the city folds its
 * own file's scorer; a unique whose clause reads a hand card (the Secret Vault,
 * which can never be built) is folded over the owner's hand instead, so the two
 * passes never count the same card.
 */
const uniquePoints = (
  state: CitadelsState,
  city: readonly PlacedDistrict[],
  seat: SeatId,
): number => {
  const placed = city.reduce((sum, district) => {
    const id = district.id;
    if (!specOfDistrict(id).unique || HAND_SCORED_UNIQUES.includes(id)) return sum;
    return sum + (UNIQUE_SCORING[id]?.(district, city, seat, state) ?? 0);
  }, 0);
  const held = playerOf(state, seat).hand.reduce((sum, id) => {
    if (!HAND_SCORED_UNIQUES.includes(id)) return sum;
    return sum + (UNIQUE_SCORING[id]?.({ id, gold: 0 }, city, seat, state) ?? 0);
  }, 0);
  return placed + held;
};

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
 * The highest rank a seat revealed this round, or 0 when the seat is unclaimed.
 * The catalog's tie-break reads "the tied player who revealed the
 * highest-numbered rank in the last round", and `claimed` carries each seat's
 * revealed character (two in the 2- and 3-player games).
 */
const revealedRank = (state: CitadelsState, seat: SeatId): number =>
  state.claimed.reduce(
    (best, claim) => (claim.seat === seat ? Math.max(best, characterRank(claim.character)) : best),
    0,
  );

/**
 * The winner: highest total, tie-broken by the highest revealed rank (the
 * catalog rule). Two seats that tie on total, revealed rank, district points,
 * and gold have no winner.
 */
export const winnerOf = (state: CitadelsState): SeatId | null => {
  const scores = [...scoreGame(state)];
  if (scores.length === 0) return null;
  const goldOf = (seat: SeatId): number => playerOf(state, seat).gold;
  const rankOf = (seat: SeatId): number => revealedRank(state, seat);
  scores.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (rankOf(b.seat) !== rankOf(a.seat)) return rankOf(b.seat) - rankOf(a.seat);
    if (b.districts !== a.districts) return b.districts - a.districts;
    return goldOf(b.seat) - goldOf(a.seat);
  });
  const top = scores[0];
  if (top === undefined) return null;
  const tied = scores.filter(
    (score) =>
      score.total === top.total &&
      rankOf(score.seat) === rankOf(top.seat) &&
      score.districts === top.districts &&
      goldOf(score.seat) === goldOf(top.seat),
  );
  return tied.length === 1 ? top.seat : null;
};
