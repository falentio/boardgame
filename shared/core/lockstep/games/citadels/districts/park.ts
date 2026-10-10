import type { DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the park district's ability is filled in by its own worker. */
export const park: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for park; its own worker fills this in. */
export const parkScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to; empty means never called. */
export const parkTriggers: readonly DistrictHook[] = [];
