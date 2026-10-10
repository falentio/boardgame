import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the scriptorium district's ability is filled in by its own worker. */
export const scriptorium: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for scriptorium; its own worker fills this in. */
export const scriptoriumScoring: DistrictScoring = () => 0;
