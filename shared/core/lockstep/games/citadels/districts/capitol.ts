import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the capitol district's ability is filled in by its own worker. */
export const capitol: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for capitol; its own worker fills this in. */
export const capitolScoring: DistrictScoring = () => 0;
