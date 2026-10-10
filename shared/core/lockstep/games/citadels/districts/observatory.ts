import type { DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the observatory district's ability is filled in by its own worker. */
export const observatory: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for observatory; its own worker fills this in. */
export const observatoryScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to; empty means never called. */
export const observatoryTriggers: readonly DistrictHook[] = [];
