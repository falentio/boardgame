import type { BuildQuery, DistrictHook } from "../districts.ts";
import { typeOfPlaced } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Wishing Well scores only at end of game; the engine never calls it in play. */
export const wishingWell: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/**
 * One extra point for each unique district in the city, the Wishing Well
 * included. A district is unique only when the type it declares is unique, so a
 * Haunted Quarter or School of Magic re-typed to a colour is not a unique here.
 */
export const wishingWellScoring: DistrictScoring = (_district, city) =>
  city.filter((placed) => typeOfPlaced(placed) === "unique").length;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const wishingWellBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const wishingWellTriggers: readonly DistrictHook[] = [];
