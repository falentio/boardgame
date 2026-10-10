import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the statue district's ability is filled in by its own worker. */
export const statue: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for statue; its own worker fills this in. */
export const statueScoring: DistrictScoring = () => 0;
