import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the haunted-quarter district's ability is filled in by its own worker. */
export const hauntedQuarter: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for haunted-quarter; its own worker fills this in. */
export const hauntedQuarterScoring: DistrictScoring = () => 0;
