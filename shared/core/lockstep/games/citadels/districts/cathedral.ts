import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the cathedral district's ability is filled in by its own worker. */
export const cathedral: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for cathedral; its own worker fills this in. */
export const cathedralScoring: DistrictScoring = () => 0;
