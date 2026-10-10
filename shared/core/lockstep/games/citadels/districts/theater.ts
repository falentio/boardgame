import type { WindowResolver } from "../helpers.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the theater district's ability is filled in by its own worker. */
export const theater: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for theater; its own worker fills this in. */
export const theaterScoring: DistrictScoring = () => 0;

/** Stub: the theatre-swap window pops until the theater worker fills it in. */
export const theaterResolve: WindowResolver = (ctx) => ({
  ...ctx.state,
  steps: ctx.state.steps.slice(1),
});
