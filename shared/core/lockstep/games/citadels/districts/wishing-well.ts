import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the wishing-well district's ability is filled in by its own worker. */
export const wishingWell: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for wishing-well; its own worker fills this in. */
export const wishingWellScoring: DistrictScoring = () => 0;
