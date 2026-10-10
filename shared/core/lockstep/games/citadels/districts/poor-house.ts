import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the poor-house district's ability is filled in by its own worker. */
export const poorHouse: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for poor-house; its own worker fills this in. */
export const poorHouseScoring: DistrictScoring = () => 0;
