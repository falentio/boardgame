import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the university district's ability is filled in by its own worker. */
export const university: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for university; its own worker fills this in. */
export const universityScoring: DistrictScoring = () => 0;
