import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the keep district's ability is filled in by its own worker. */
export const keep: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for keep; its own worker fills this in. */
export const keepScoring: DistrictScoring = () => 0;
