import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the smithy district's ability is filled in by its own worker. */
export const smithy: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for smithy; its own worker fills this in. */
export const smithyScoring: DistrictScoring = () => 0;
