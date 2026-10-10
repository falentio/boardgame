import type { SeatId } from "../../../index.ts";
import type { CharacterEffect } from "../characters/index.ts";
import {
  actionOf,
  emptyPending,
  patchPending,
  playerOf,
  winStep,
  withPending,
  withPlayer,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/** The most districts one Artist turn may beautify. */
const MAX_BEAUTIFY = 2;

/** A district the Artist may still beautify: unmarked, and payable from the stash. */
const canBeautify = (state: CitadelsState, seat: SeatId): boolean => {
  const player = playerOf(state, seat);
  return player.gold > 0 && player.city.some((district) => district.gold === 0);
};

/**
 * Beautify up to two of the Artist's own districts. Each beautified district
 * takes one gold from the Artist's stash onto it; that marker is the district's
 * permanent +1 cost, so it scores one more point and costs one more to destroy.
 * The window re-opens until two are marked, the stash empties, no unmarked
 * district remains, or the Artist passes.
 */
export const artist: CharacterEffect = (ctx) => {
  if (!canBeautify(ctx.state, ctx.seat)) return withSteps(ctx.state, ctx.rest);
  const pending = withPending(ctx.state, emptyPending(ctx.seat, "artist"));
  return withSteps(pending, [winStep("artist-beautify", [ctx.seat]), ...ctx.rest]);
};

/** Place one gold from `seat`'s stash on city district `index`, or null when illegal. */
const beautify = (state: CitadelsState, seat: SeatId, index: number): CitadelsState | null => {
  const player = playerOf(state, seat);
  const target = player.city[index];
  if (target === undefined || target.gold > 0 || player.gold < 1) return null;
  const city = player.city.map((district, at) =>
    at === index ? { ...district, gold: district.gold + 1 } : district,
  );
  return withPlayer(state, { ...player, gold: player.gold - 1, city });
};

/**
 * The Artist names a city district by index through a `keep` action; a `pass`
 * (or any illegal pick, such as an already-beautified district) ends the window.
 */
export const artistResolve: WindowResolver = (ctx) => {
  const rest = ctx.state.steps.slice(1);
  const seat = ctx.window.seats[0] ?? ctx.state.pending?.actor ?? ctx.state.active;
  const pending = ctx.state.pending;
  if (pending === null || pending.character !== "artist") return withSteps(ctx.state, rest);
  const action = actionOf(ctx.frame, seat);
  const wanted = action?.t === "keep" ? action.index : -1;
  const index = Number.isInteger(wanted) && wanted >= 0 ? wanted : -1;
  const done = pending.amount;
  const marked = index >= 0 && done < MAX_BEAUTIFY ? beautify(ctx.state, seat, index) : null;
  if (marked === null) return withSteps(withPending(ctx.state, null), rest);
  const advanced = patchPending(marked, { amount: done + 1 });
  if (done + 1 < MAX_BEAUTIFY && canBeautify(advanced, seat)) {
    return withSteps(advanced, [winStep("artist-beautify", [seat]), ...rest]);
  }
  return withSteps(withPending(advanced, null), rest);
};
