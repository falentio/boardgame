import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { withSteps } from "../helpers.ts";
import type { WindowResolver } from "../helpers.ts";

/** Stub: the diplomat's ability is filled in by its own worker. */
export const diplomat: CharacterEffect = (ctx: CharacterCtx) => withSteps(ctx.state, ctx.rest);

/** Stub: the windows the diplomat opens are resolved by its own worker. */
export const diplomatResolve: WindowResolver = (ctx) => withSteps(ctx.state, ctx.state.steps.slice(1));
