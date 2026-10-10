import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { withSteps } from "../helpers.ts";
import type { WindowResolver } from "../helpers.ts";

/** Stub: the thief's ability is filled in by its own worker. */
export const thief: CharacterEffect = (ctx: CharacterCtx) => withSteps(ctx.state, ctx.rest);

/** Stub: the windows the thief opens are resolved by its own worker. */
export const thiefResolve: WindowResolver = (ctx) => withSteps(ctx.state, ctx.state.steps.slice(1));
