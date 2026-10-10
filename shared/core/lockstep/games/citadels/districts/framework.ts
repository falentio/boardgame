import type { DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the framework district's ability is filled in by its own worker. */
export const framework: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for framework; its own worker fills this in. */
export const frameworkScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to; empty means never called. */
export const frameworkTriggers: readonly DistrictHook[] = [];
