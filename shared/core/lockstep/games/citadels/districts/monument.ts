import type { BuildQuery, DistrictHook } from "../districts.ts";
import { specOfDistrict } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const MONUMENT_ID = "monument";

/** The city size at which the Monument may no longer be built. */
const BUILD_CEILING = 5;

/**
 * You cannot build the Monument once your city already has five districts. The
 * engine folds this query for the card being built, so `legal: false` refuses
 * the build before any gold changes hands. The gate fires only for the Monument
 * itself; a Monument already in the city must not gate a later build.
 */
export const monumentBuild: BuildQuery = (ctx) =>
  ctx.card === MONUMENT_ID && ctx.city.length >= BUILD_CEILING ? { legal: false } : {};

/** The Monument's in-play clause is the build gate above; nothing runs on build. */
export const monument: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/**
 * At end of game the Monument counts as two districts. The scoring pass already
 * counts the first district as its cost, so the second district adds that cost
 * again: the Monument is worth twice its catalog cost in total.
 */
export const monumentScoring: DistrictScoring = (district) =>
  specOfDistrict(district.id).cost;

/** The engine hook this district answers; the gate itself is the BuildQuery. */
export const monumentTriggers: readonly DistrictHook[] = ["onBuild"];
