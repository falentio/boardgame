import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the ivory-tower district's ability is filled in by its own worker. */
export const ivoryTower: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for ivory-tower; its own worker fills this in. */
export const ivoryTowerScoring: DistrictScoring = () => 0;
