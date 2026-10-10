import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** How many cards the Observatory deals when its owner gathers by drawing. */
const DRAW_COUNT = 3;

/**
 * When you choose cards while gathering resources, draw three and keep one. The
 * gather arms a pending record before dealing: the draw count rides on
 * `pending.amount` and the keep count on `pending.gold`. The Observatory raises
 * only the draw count, so the keep window still takes one of the three. A gold
 * gather never reaches the draw hook, so the Observatory only fires on a draw.
 */
export const observatory: DistrictEffect = (ctx: DistrictCtx) => {
  const pending = ctx.state.pending;
  if (pending === null) return ctx.state;
  return { ...ctx.state, pending: { ...pending, amount: DRAW_COUNT } };
};

/** The Observatory carries no end-game points of its own. */
export const observatoryScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const observatoryBuild: BuildQuery = () => ({});

/** The Observatory answers the gather-draw hook, where it deals three. */
export const observatoryTriggers: readonly DistrictHook[] = ["onDraw"];
