import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the wharf district's ability is filled in by its own worker. */
export const wharf: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for wharf; its own worker fills this in. */
export const wharfScoring: DistrictScoring = () => 0;
