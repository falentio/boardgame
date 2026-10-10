import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/**
 * When you choose cards while gathering resources, keep both you drew. The
 * gather arms a pending record before dealing: the draw count rides on
 * `pending.amount` and the keep count on `pending.gold`. The Library raises the
 * keep count to the draw count, so the keep window takes every card dealt. A
 * gold gather never reaches the draw hook, so the Library only fires on a draw.
 */
export const library: DistrictEffect = (ctx: DistrictCtx) => {
  const pending = ctx.state.pending;
  if (pending === null) return ctx.state;
  return { ...ctx.state, pending: { ...pending, gold: pending.amount } };
};

/** The Library carries no end-game points of its own. */
export const libraryScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const libraryBuild: BuildQuery = () => ({});

/** The Library answers the gather-draw hook, where it keeps both cards. */
export const libraryTriggers: readonly DistrictHook[] = ["onDraw"];
