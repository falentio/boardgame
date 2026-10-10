import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the great-wall district's ability is filled in by its own worker. */
export const greatWall: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for great-wall; its own worker fills this in. */
export const greatWallScoring: DistrictScoring = () => 0;
