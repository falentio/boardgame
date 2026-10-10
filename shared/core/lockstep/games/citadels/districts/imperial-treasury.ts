import type { DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the imperial-treasury district's ability is filled in by its own worker. */
export const imperialTreasury: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for imperial-treasury; its own worker fills this in. */
export const imperialTreasuryScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to; empty means never called. */
export const imperialTreasuryTriggers: readonly DistrictHook[] = [];
