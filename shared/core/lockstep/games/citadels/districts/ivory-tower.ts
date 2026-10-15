import type { BuildQuery, DistrictHook } from "../districts.ts";
import { typeOfPlaced } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Ivory Tower scores only at end of game; the engine never calls it in play. */
export const ivoryTower: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Five extra points when the Ivory Tower is the city's only unique district. */
const IVORY_TOWER_BONUS = 5;

/**
 * A district counts as a unique when the type it declares is unique, read through
 * the module's one placed-type reader. The Haunted Quarter and the School of
 * Magic report their catalog type, unique, until their owner names a colour, so an
 * undeclared one is a second unique and the tower scores nothing; once a
 * non-unique type is declared the tower scores. This is the same reading the
 * Wishing Well and the colour bonus use, so no reader treats one card two ways.
 */
export const ivoryTowerScoring: DistrictScoring = (_district, city) => {
  const uniques = city.filter((placed) => typeOfPlaced(placed) === "unique");
  return uniques.length === 1 ? IVORY_TOWER_BONUS : 0;
};

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const ivoryTowerBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const ivoryTowerTriggers: readonly DistrictHook[] = [];
