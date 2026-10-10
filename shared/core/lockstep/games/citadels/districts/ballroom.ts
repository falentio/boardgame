import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the ballroom district's ability is filled in by its own worker. */
export const ballroom: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for ballroom; its own worker fills this in. */
export const ballroomScoring: DistrictScoring = () => 0;
