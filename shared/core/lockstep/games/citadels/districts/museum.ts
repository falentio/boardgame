import type { SeatId } from "../../../index.ts";
import type { CitadelsAction } from "../actions.ts";
import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { CitadelsState, PlacedDistrict } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Museum's catalog id. */
export const MUSEUM_ID = "museum";

const playerOf = (state: CitadelsState, seat: SeatId): CitadelsState["players"][number] => {
  const player = state.players.find((candidate) => candidate.seat === seat);
  if (player === undefined) throw new Error(`seat ${seat} is not a player`);
  return player;
};

const withPlayer = (
  state: CitadelsState,
  next: CitadelsState["players"][number],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === next.seat ? next : player)),
});

/** Whether `seat`'s city holds a Museum, the district the placement offer belongs to. */
export const museumIn = (state: CitadelsState, seat: SeatId): boolean =>
  playerOf(state, seat).city.some((district) => district.id === MUSEUM_ID);

/**
 * Place one card from the owner's hand under the Museum. The rule is "you may
 * place", so only a `keep` action names a card to tuck; any other report — a
 * `pass` above all — declines and leaves the Museum untouched. An empty hand
 * leaves it untouched too.
 *
 * This file is reached from the engine's `keep` resolver in helpers.ts, so it
 * may not import helpers at runtime: helpers imports `districts/effects.ts`,
 * which imports this file, and a runtime edge back would close the cycle. The
 * few helpers it needs are local for that reason.
 */
export const museumPlace = (
  state: CitadelsState,
  seat: SeatId,
  action: CitadelsAction | null,
): CitadelsState => {
  if (action?.t !== "keep") return state;
  const player = playerOf(state, seat);
  const wanted = action.index;
  const at =
    Number.isInteger(wanted) && wanted >= 0 && wanted < player.hand.length ? wanted : 0;
  const card = player.hand[at];
  if (card === undefined) return state;
  const city = player.city.map((district): PlacedDistrict =>
    district.id === MUSEUM_ID
      ? { ...district, cards: [...(district.cards ?? []), card] }
      : district,
  );
  const hand = player.hand.filter((_, index) => index !== at);
  return withPlayer(state, { ...player, hand, city });
};

/** The Museum scores only at end of game; its placement offer rides the `keep` window. */
export const museum: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/**
 * One point for each card tucked under the Museum. The attachments live on
 * `PlacedDistrict.cards`, which the codec round-trips, so the count survives the
 * encode/decode the engine performs between frames.
 */
export const museumScoring: DistrictScoring = (district) => district.cards?.length ?? 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const museumBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; its placement rides the `keep` window. */
export const museumTriggers: readonly DistrictHook[] = [];
