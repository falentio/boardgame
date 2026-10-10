import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the theatre district's ability is filled in by its own worker. */
export const theatre: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for theatre; its own worker fills this in. */
export const theatreScoring: DistrictScoring = () => 0;
