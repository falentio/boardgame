import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the monument district's ability is filled in by its own worker. */
export const monument: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for monument; its own worker fills this in. */
export const monumentScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const monumentBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const monumentTriggers: readonly DistrictHook[] = [];
