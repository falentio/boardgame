import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { withSteps } from "../helpers.ts";
import type { WindowResolver } from "../helpers.ts";

/** Stub: the magistrate's ability is filled in by its own worker. */
export const magistrate: CharacterEffect = (ctx: CharacterCtx) => withSteps(ctx.state, ctx.rest);

/** Stub: the windows the magistrate opens are resolved by its own worker. */
export const magistrateResolve: WindowResolver = (ctx) => withSteps(ctx.state, ctx.state.steps.slice(1));
