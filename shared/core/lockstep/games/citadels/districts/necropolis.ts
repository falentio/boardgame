import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the necropolis district's ability is filled in by its own worker. */
export const necropolis: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for necropolis; its own worker fills this in. */
export const necropolisScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const necropolisBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const necropolisTriggers: readonly DistrictHook[] = [];
