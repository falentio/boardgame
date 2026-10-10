import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the menagerie district's ability is filled in by its own worker. */
export const menagerie: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for menagerie; its own worker fills this in. */
export const menagerieScoring: DistrictScoring = () => 0;
