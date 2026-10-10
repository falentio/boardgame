import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { withSteps } from "../helpers.ts";
import type { WindowResolver } from "../helpers.ts";

/** Stub: the patrician's ability is filled in by its own worker. */
export const patrician: CharacterEffect = (ctx: CharacterCtx) => withSteps(ctx.state, ctx.rest);

/** Stub: the windows the patrician opens are resolved by its own worker. */
export const patricianResolve: WindowResolver = (ctx) => withSteps(ctx.state, ctx.state.steps.slice(1));
