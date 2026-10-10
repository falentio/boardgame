import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { withSteps } from "../helpers.ts";
import type { WindowResolver } from "../helpers.ts";

/** Stub: the spy's ability is filled in by its own worker. */
export const spy: CharacterEffect = (ctx: CharacterCtx) => withSteps(ctx.state, ctx.rest);

/** Stub: the windows the spy opens are resolved by its own worker. */
export const spyResolve: WindowResolver = (ctx) => withSteps(ctx.state, ctx.state.steps.slice(1));
