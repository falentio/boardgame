import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { withSteps } from "../helpers.ts";
import type { WindowResolver } from "../helpers.ts";

/** Stub: the trader's ability is filled in by its own worker. */
export const trader: CharacterEffect = (ctx: CharacterCtx) => withSteps(ctx.state, ctx.rest);

/** Stub: the windows the trader opens are resolved by its own worker. */
export const traderResolve: WindowResolver = (ctx) => withSteps(ctx.state, ctx.state.steps.slice(1));
