import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { WindowResolver } from "../helpers.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the theater district's ability is filled in by its own worker. */
export const theater: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/**
 * The Theater carries no end-game points: the catalog gives it an in-round
 * ability (swap your character for another player's at the start of the round),
 * not a scoring bonus. So it adds zero to its owner's final score.
 */
export const theaterScoring: DistrictScoring = () => 0;

/** Stub: the theatre-swap window pops until the theater worker fills it in. */
export const theaterResolve: WindowResolver = (ctx) => ({
  ...ctx.state,
  steps: ctx.state.steps.slice(1),
});

/**
 * The Theater responds to no engine hook here. Its rulebook ability fires at the
 * start of the round, and the engine has no round-start district hook, so this
 * row stays empty; see the unit report for the shared-file change it needs.
/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const theaterBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const theaterTriggers: readonly DistrictHook[] = [];
