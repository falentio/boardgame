import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the thieves-den district's ability is filled in by its own worker. */
export const thievesDen: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for thieves-den; its own worker fills this in. */
export const thievesDenScoring: DistrictScoring = () => 0;
