import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { addGold, popWindow, withPending, withSteps, type WindowResolver } from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/**
 * Return to a seat the gold it paid to build districts this turn. Only the build
 * path contributes to that figure, so gold paid for any other reason (the
 * Smithy, the Tax Collector) is never in it. Nothing paid means nothing returns.
 */
export const alchemistRefund = (state: CitadelsState, seat: SeatId, paid: number): CitadelsState =>
  paid <= 0 ? state : addGold(state, seat, paid);

/**
 * At the end of the Alchemist's turn, take back every gold paid to build
 * districts this turn. That spend is carried on the turn-local pending record's
 * gold counter, which the build path credits and which reads zero when no
 * district was paid for. Because the refund lands after the turn's builds, the
 * Alchemist can only ever have built what it could afford at the time.
 */
export const alchemist: CharacterEffect = (ctx) => {
  const pending = ctx.state.pending;
  const seat = pending?.actor ?? ctx.seat;
  const paid = pending?.gold ?? 0;
  return withSteps(withPending(alchemistRefund(ctx.state, seat, paid), null), ctx.rest);
};

/** The Alchemist opens no window; a stray call pops and continues. */
export const alchemistResolve: WindowResolver = (ctx) => popWindow(ctx.state);
