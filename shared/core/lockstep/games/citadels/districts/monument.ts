import type { BuildQuery, DistrictHook } from "../districts.ts";
import { specOfDistrict } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const MONUMENT_ID = "monument";

/** Five districts in the city already forbid the Monument ("five or more"). */
const FIVE_DISTRICTS = 5;

/**
 * You cannot build the Monument if your city already has five or more districts.
 * The engine folds every unique already in the builder's city and then the card
 * being built, so this query must answer only for the Monument itself; a Monument
 * already standing in the city would otherwise gate every later build. `ctx.city`
 * is the builder's city as it stands before this build, so five or more there
 * refuses the build before any gold or hand card moves.
 */
export const monumentBuild: BuildQuery = (ctx) =>
  ctx.card === MONUMENT_ID && ctx.city.length >= FIVE_DISTRICTS ? { legal: false } : {};

/** The Monument's in-play clause is the gate above; building it mutates no state. */
export const monument: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/**
 * At end of game the Monument counts as two districts, so it is worth twice its
 * cost (the rulebook's "its value is thus 8 gold" for a cost-4 card). The scoring
 * pass already sums the card's cost once as a district; paying that cost again as
 * unique points is the second district, so the Monument scores `2 * cost`.
 */
export const monumentScoring: DistrictScoring = (district) =>
  specOfDistrict(district.id).cost;

/** The engine hook this district answers; the gate itself is the BuildQuery. */
export const monumentTriggers: readonly DistrictHook[] = ["onBuild"];
