import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { withSteps } from "../helpers.ts";
import type { WindowResolver } from "../helpers.ts";

/** Stub: the tax-collector's ability is filled in by its own worker. */
export const taxCollector: CharacterEffect = (ctx: CharacterCtx) => withSteps(ctx.state, ctx.rest);

/** Stub: the windows the tax-collector opens are resolved by its own worker. */
export const taxCollectorResolve: WindowResolver = (ctx) => withSteps(ctx.state, ctx.state.steps.slice(1));
