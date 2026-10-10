import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the school-of-magic district's ability is filled in by its own worker. */
export const schoolOfMagic: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for school-of-magic; its own worker fills this in. */
export const schoolOfMagicScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const schoolOfMagicBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const schoolOfMagicTriggers: readonly DistrictHook[] = [];
