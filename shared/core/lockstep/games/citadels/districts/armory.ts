import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the armory district's ability is filled in by its own worker. */
export const armory: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for armory; its own worker fills this in. */
export const armoryScoring: DistrictScoring = () => 0;
