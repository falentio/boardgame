import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the bell-tower district's ability is filled in by its own worker. */
export const bellTower: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for bell-tower; its own worker fills this in. */
export const bellTowerScoring: DistrictScoring = () => 0;
