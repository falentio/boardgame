import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the library district's ability is filled in by its own worker. */
export const library: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for library; its own worker fills this in. */
export const libraryScoring: DistrictScoring = () => 0;
