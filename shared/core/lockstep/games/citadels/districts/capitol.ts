import type { BuildQuery, DistrictHook } from "../districts.ts";
import { typeOfPlaced } from "../districts.ts";
import type { PlacedDistrict } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Capitol scores only at end of game; the engine never calls it in play. */
export const capitol: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Three districts of one type earn a flat three points, once, however many types qualify. */
const THREE_OF_A_TYPE = 3;

/**
 * True when the city holds at least three districts of some one type, the
 * Capitol included. A district counts as the type it declares, per the module's
 * placed-type reader, so a School of Magic declared trade joins the trade count.
 */
const hasThreeOfAType = (city: readonly PlacedDistrict[]): boolean => {
  const counts = new Map<string, number>();
  for (const district of city) {
    const type = typeOfPlaced(district);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  for (const count of counts.values()) {
    if (count >= 3) return true;
  }
  return false;
};

/** Three extra points when the city shows three districts of one type, and only once. */
export const capitolScoring: DistrictScoring = (_district, city) =>
  hasThreeOfAType(city) ? THREE_OF_A_TYPE : 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const capitolBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const capitolTriggers: readonly DistrictHook[] = [];
