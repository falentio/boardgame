import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { withSteps } from "../helpers.ts";
import type { WindowResolver } from "../helpers.ts";

/** Stub: the architect's ability is filled in by its own worker. */
export const architect: CharacterEffect = (ctx: CharacterCtx) => withSteps(ctx.state, ctx.rest);

/** Stub: the windows the architect opens are resolved by its own worker. */
export const architectResolve: WindowResolver = (ctx) => withSteps(ctx.state, ctx.state.steps.slice(1));
