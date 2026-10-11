import type { BuildQuery, DistrictHook } from "../districts.ts";
import { specOfDistrict } from "../districts.ts";
import type { PlacedDistrict } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Ivory Tower scores only at end of game; the engine never calls it in play. */
export const ivoryTower: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

const HAUNTED_QUARTER = "haunted-quarter";

/** Five extra points when the Ivory Tower is the city's only unique district. */
const IVORY_TOWER_BONUS = 5;

/**
 * A district counts as a unique for the Ivory Tower when its catalog type is
 * unique, except the Haunted Quarter: its owner chooses its type at final
 * scoring, so it counts only when declared `unique`. An undeclared or re-typed
 * Haunted Quarter therefore does not stop the Ivory Tower from scoring.
 */
const countsAsUnique = (placed: PlacedDistrict): boolean =>
  placed.id === HAUNTED_QUARTER
    ? placed.declaredType === "unique"
    : specOfDistrict(placed.id).unique;

export const ivoryTowerScoring: DistrictScoring = (_district, city) => {
  const uniques = city.filter(countsAsUnique);
  return uniques.length === 1 ? IVORY_TOWER_BONUS : 0;
};

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const ivoryTowerBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const ivoryTowerTriggers: readonly DistrictHook[] = [];
