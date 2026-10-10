import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the monument district's ability is filled in by its own worker. */
export const monument: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for monument; its own worker fills this in. */
export const monumentScoring: DistrictScoring = () => 0;
