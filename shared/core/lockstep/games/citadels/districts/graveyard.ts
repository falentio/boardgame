import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the graveyard district's ability is filled in by its own worker. */
export const graveyard: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for graveyard; its own worker fills this in. */
export const graveyardScoring: DistrictScoring = () => 0;
