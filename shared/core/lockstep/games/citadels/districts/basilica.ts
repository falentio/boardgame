import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the basilica district's ability is filled in by its own worker. */
export const basilica: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for basilica; its own worker fills this in. */
export const basilicaScoring: DistrictScoring = () => 0;
