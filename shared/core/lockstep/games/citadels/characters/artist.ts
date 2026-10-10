import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { withSteps } from "../helpers.ts";
import type { WindowResolver } from "../helpers.ts";

/** Stub: the artist's ability is filled in by its own worker. */
export const artist: CharacterEffect = (ctx: CharacterCtx) => withSteps(ctx.state, ctx.rest);

/** Stub: the windows the artist opens are resolved by its own worker. */
export const artistResolve: WindowResolver = (ctx) => withSteps(ctx.state, ctx.state.steps.slice(1));
