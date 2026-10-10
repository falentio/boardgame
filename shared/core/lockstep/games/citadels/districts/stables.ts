import type { DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the stables district's ability is filled in by its own worker. */
export const stables: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for stables; its own worker fills this in. */
export const stablesScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to; empty means never called. */
export const stablesTriggers: readonly DistrictHook[] = [];
