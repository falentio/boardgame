import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Museum scores only at end of game; the engine never calls it in play. */
export const museum: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/**
 * One point for each card tucked under the Museum. The attachments live on
 * `PlacedDistrict.cards`, which the codec round-trips, so the count survives the
 * encode/decode the engine performs between frames.
 */
export const museumScoring: DistrictScoring = (district) => district.cards?.length ?? 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const museumBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const museumTriggers: readonly DistrictHook[] = [];
