import type { DistrictHook } from "../districts.ts";
import { specOfDistrict } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Wishing Well scores only at end of game; the engine never calls it in play. */
export const wishingWell: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** One extra point for each unique district in the city, the Wishing Well included. */
export const wishingWellScoring: DistrictScoring = (_district, city) =>
  city.filter((placed) => specOfDistrict(placed.id).unique).length;

/** The engine hooks this district responds to; empty means never called. */
export const wishingWellTriggers: readonly DistrictHook[] = [];
