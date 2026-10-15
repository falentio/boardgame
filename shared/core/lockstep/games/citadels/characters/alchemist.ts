import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import {
  addGold,
  popWindow,
  RESOLVE,
  withPending,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState, Step } from "../state.ts";

/**
 * Return to a seat the gold it paid to build districts this turn. Only the build
 * path contributes to that figure, so gold paid for any other reason (the
 * Smithy, the Tax Collector) is never in it. Nothing paid means nothing returns.
 */
export const alchemistRefund = (state: CitadelsState, seat: SeatId, paid: number): CitadelsState =>
  paid <= 0 ? state : addGold(state, seat, paid);

/** Tags the turn-open pass so the end-of-turn pass is distinguishable. */
const SETTLE_NOTE = "alchemist-settle";

/** True when the effect runs as the turn opens, with the turn window still ahead. */
const atTurnTop = (rest: readonly Step[]): boolean => {
  const top = rest[0];
  return top !== undefined && top.kind === "window" && top.window.purpose === "turn";
};

/**
 * At the end of the Alchemist's turn, take back every gold paid to build
 * districts this turn. That spend rides on the turn-local pending record's gold
 * counter, which the build path credits (see `tryBuild`).
 *
 * The effect runs twice: once when the character is called, before the turn's
 * build window, and once after that window closes. The turn-open pass leaves the
 * pending in place so a build can add to it, and pushes a resolve step below the
 * turn window; the end pass reads the pending and refunds. Because the refund
 * lands after the turn's build, the Alchemist can only ever have built what it
 * could afford at the time.
 */
export const alchemist: CharacterEffect = (ctx) => {
  const pending = ctx.state.pending;
  const seat = pending?.actor ?? ctx.seat;
  const atTop =
    pending !== null &&
    pending.character === "alchemist" &&
    pending.note === null &&
    atTurnTop(ctx.rest);
  if (atTop) {
    const turn = ctx.rest[0];
    if (turn === undefined) return withSteps(ctx.state, ctx.rest);
    return withSteps(withPending(ctx.state, { ...pending, note: SETTLE_NOTE }), [
      turn,
      RESOLVE,
      ...ctx.rest.slice(1),
    ]);
  }
  const paid = pending?.gold ?? 0;
  return withSteps(withPending(alchemistRefund(ctx.state, seat, paid), null), ctx.rest);
};

/** The Alchemist opens no window; a stray call pops and continues. */
export const alchemistResolve: WindowResolver = (ctx) => popWindow(ctx.state);
