import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the laboratory district's ability is filled in by its own worker. */
export const laboratory: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for laboratory; its own worker fills this in. */
export const laboratoryScoring: DistrictScoring = () => 0;
