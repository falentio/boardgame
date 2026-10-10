import type { DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the gold-mine district's ability is filled in by its own worker. */
export const goldMine: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for gold-mine; its own worker fills this in. */
export const goldMineScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to; empty means never called. */
export const goldMineTriggers: readonly DistrictHook[] = [];
