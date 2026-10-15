import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/**
 * The Necropolis pays for itself by destroying a district already in its owner's
 * city instead of charging gold. The rulebook makes the trade optional; the
 * build seam carries no decline, so the query fires whenever there is a district
 * to destroy and the Necropolis otherwise pays its catalog cost. The card is
 * named so the offer attaches only to a Necropolis build: a Necropolis already
 * in the city never prices a later build.
 */
export const necropolisBuild: BuildQuery = (ctx) =>
  ctx.card === "necropolis" && ctx.city.length > 0 ? { destroy: true } : {};

/** The Necropolis's ability is the build query above; the onBuild hook changes nothing. */
export const necropolis: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** The Necropolis scores no end-game points of its own. */
export const necropolisScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to; empty means never called. */
export const necropolisTriggers: readonly DistrictHook[] = ["onBuild"];
