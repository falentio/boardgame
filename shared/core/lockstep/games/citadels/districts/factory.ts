import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the factory district's ability is filled in by its own worker. */
export const factory: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for factory; its own worker fills this in. */
export const factoryScoring: DistrictScoring = () => 0;
