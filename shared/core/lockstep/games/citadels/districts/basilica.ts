import type { BuildQuery, DistrictHook } from "../districts.ts";
import { specOfDistrict } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Basilica scores only at end of game; the engine never calls it in play. */
export const basilica: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/**
 * One extra point for each district of odd cost in the city, the Basilica
 * included. A beautified district's cost is its catalog cost plus its gold
 * marker, matching the score's cost sum, so a Market with one beautify gold
 * counts at cost 3 and earns a point.
 */
export const basilicaScoring: DistrictScoring = (_district, city) =>
  city.filter((placed) => (specOfDistrict(placed.id).cost + placed.gold) % 2 === 1).length;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const basilicaBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const basilicaTriggers: readonly DistrictHook[] = [];
