import type { DistrictHook } from "../districts.ts";
import { specOfDistrict } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Basilica scores only at end of game; the engine never calls it in play. */
export const basilica: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** One extra point for each district of odd cost in the city, the Basilica included. */
export const basilicaScoring: DistrictScoring = (_district, city) =>
  city.filter((placed) => specOfDistrict(placed.id).cost % 2 === 1).length;

/** The engine hooks this district responds to; empty means never called. */
export const basilicaTriggers: readonly DistrictHook[] = [];
