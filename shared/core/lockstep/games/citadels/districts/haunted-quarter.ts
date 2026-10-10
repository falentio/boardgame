import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the haunted-quarter district's ability is filled in by its own worker. */
export const hauntedQuarter: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for haunted-quarter; its own worker fills this in. */
export const hauntedQuarterScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const hauntedQuarterBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const hauntedQuarterTriggers: readonly DistrictHook[] = [];
