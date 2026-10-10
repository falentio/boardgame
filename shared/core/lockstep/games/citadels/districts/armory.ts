import type { DistrictHook } from "../districts.ts";
import type { WindowResolver } from "../helpers.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the armory district's ability is filled in by its own worker. */
export const armory: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for armory; its own worker fills this in. */
export const armoryScoring: DistrictScoring = () => 0;

/** Stub: the armory-destroy window pops until the armory worker fills it in. */
export const armoryResolve: WindowResolver = (ctx) => ({
  ...ctx.state,
  steps: ctx.state.steps.slice(1),
});

/** The engine hooks this district responds to; empty means never called. */
export const armoryTriggers: readonly DistrictHook[] = [];
