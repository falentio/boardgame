import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the quarry district's ability is filled in by its own worker. */
export const quarry: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for quarry; its own worker fills this in. */
export const quarryScoring: DistrictScoring = () => 0;
