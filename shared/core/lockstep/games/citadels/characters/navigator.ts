import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { withSteps } from "../helpers.ts";
import type { WindowResolver } from "../helpers.ts";

/** Stub: the navigator's ability is filled in by its own worker. */
export const navigator: CharacterEffect = (ctx: CharacterCtx) => withSteps(ctx.state, ctx.rest);

/** Stub: the windows the navigator opens are resolved by its own worker. */
export const navigatorResolve: WindowResolver = (ctx) => withSteps(ctx.state, ctx.state.steps.slice(1));
