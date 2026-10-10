import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the museum district's ability is filled in by its own worker. */
export const museum: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for museum; its own worker fills this in. */
export const museumScoring: DistrictScoring = () => 0;
