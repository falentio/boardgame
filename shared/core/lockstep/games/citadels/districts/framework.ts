import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/**
 * The Framework lets its owner pay for any district with the Framework itself:
 * the build destroys the Framework instead of charging gold. The query fires
 * only while the Framework stands in the city being folded, so a build of the
 * Framework itself (with no Framework yet in the city) still pays its cost. The
 * seam carries no decline, so the offer is taken whenever the Framework is in
 * the city.
 */
export const frameworkBuild: BuildQuery = (ctx) =>
  ctx.city.some((district) => district.id === "framework") ? { destroy: true } : {};

/** The Framework's ability is the build query above; the onBuild hook changes nothing. */
export const framework: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** The Framework scores no end-game points of its own. */
export const frameworkScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to; empty means never called. */
export const frameworkTriggers: readonly DistrictHook[] = ["onBuild"];
