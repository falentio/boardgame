import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the necropolis district's ability is filled in by its own worker. */
export const necropolis: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for necropolis; its own worker fills this in. */
export const necropolisScoring: DistrictScoring = () => 0;
