import type { DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the quarry district's ability is filled in by its own worker. */
export const quarry: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for quarry; its own worker fills this in. */
export const quarryScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to; empty means never called. */
export const quarryTriggers: readonly DistrictHook[] = [];
