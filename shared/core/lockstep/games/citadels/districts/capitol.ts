import type { DistrictHook } from "../districts.ts";
import { specOfDistrict } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Capitol scores only at end of game; the engine never calls it in play. */
export const capitol: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Three districts of one type earn a flat three points, once, however many types qualify. */
const THREE_OF_A_TYPE = 3;

/** True when the city holds at least three districts of some one type, the Capitol included. */
const hasThreeOfAType = (city: readonly { readonly id: string }[]): boolean => {
  const counts = new Map<string, number>();
  for (const district of city) {
    const type = specOfDistrict(district.id).type;
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

/** The engine hooks this district responds to; empty means never called. */
export const capitolTriggers: readonly DistrictHook[] = [];
