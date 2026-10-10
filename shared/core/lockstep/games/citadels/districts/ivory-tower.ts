import type { BuildQuery, DistrictHook } from "../districts.ts";
import { specOfDistrict } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Ivory Tower scores only at end of game; the engine never calls it in play. */
export const ivoryTower: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/**
 * The Haunted Quarter's scoring-time type choice never reaches this seam, so we
 * take the branch the rulebook names: a present Haunted Quarter is counted as a
 * non-unique district and does not stop the Ivory Tower from scoring.
 */
const HAUNTED_QUARTER = "haunted-quarter";

/** Five extra points when the Ivory Tower is the city's only unique district. */
const IVORY_TOWER_BONUS = 5;

export const ivoryTowerScoring: DistrictScoring = (_district, city) => {
  const uniques = city.filter(
    (placed) => specOfDistrict(placed.id).unique && placed.id !== HAUNTED_QUARTER,
  );
  return uniques.length === 1 ? IVORY_TOWER_BONUS : 0;
};

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const ivoryTowerBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const ivoryTowerTriggers: readonly DistrictHook[] = [];
