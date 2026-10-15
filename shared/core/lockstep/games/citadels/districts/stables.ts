import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/**
 * Building the Stables does not consume the turn's build allowance: the build
 * still costs its gold, but the limit counter never rises, so the turn window
 * reopens and a second district may follow. The query fires only for the
 * Stables' own build, so a Stables already in the city never frees a later
 * build.
 */
export const stablesBuild: BuildQuery = (ctx) =>
  ctx.card === "stables" ? { countsAsBuild: false } : {};

/** The Stables' ability is the build query above; the onBuild hook changes nothing. */
export const stables: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** The Stables score no end-game points of their own. */
export const stablesScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to; empty means never called. */
export const stablesTriggers: readonly DistrictHook[] = ["onBuild"];
