import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the clock-tower district's ability is filled in by its own worker. */
export const clockTower: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for clock-tower; its own worker fills this in. */
export const clockTowerScoring: DistrictScoring = () => 0;
