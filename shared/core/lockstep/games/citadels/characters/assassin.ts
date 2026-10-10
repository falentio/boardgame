import type { CharacterId } from "../characters.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import {
  actionOf,
  emptyPending,
  END_TURN,
  patchPending,
  popWindow,
  winStep,
  withPending,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/**
 * The Assassin names a character to kill, then takes its normal turn. The kill is
 * recorded in `skipped`, which `applyCall` honors when that rank is reached, so
 * the killed character takes no turn and is never revealed.
 */
export const assassin: CharacterEffect = (ctx: CharacterCtx) =>
  withSteps(withPending(ctx.state, emptyPending(ctx.seat, "assassin")), [
    winStep("choose-character", [ctx.seat]),
    winStep("turn", [ctx.seat]),
    END_TURN,
    ...ctx.rest,
  ]);

const kill = (state: CitadelsState, named: CharacterId): CitadelsState =>
  state.skipped.includes(named) ? state : { ...state, skipped: [...state.skipped, named] };

const bewitch = (state: CitadelsState, named: CharacterId): CitadelsState => ({
  ...state,
  bewitched: named,
});

const signWarrant = (state: CitadelsState, named: CharacterId): CitadelsState => ({
  ...state,
  warrants: [named, ...state.cast.filter((id) => id !== named && id !== "magistrate").slice(0, 2)],
});

/**
 * The registry keys the whole `choose-character` purpose to this export, and the
 * three rank-1 characters (Assassin, Witch, Magistrate) each open that window, so
 * the dispatch on `pending.character` lives here. A name that is not another
 * character in the cast is void.
 */
export const assassinResolve: WindowResolver = (ctx) => {
  const { state, window } = ctx;
  const actor = state.pending?.actor ?? window.seats[0] ?? state.active;
  const chooser = state.pending?.character ?? null;
  const action = actionOf(ctx.frame, actor);
  const named: CharacterId | null = action?.t === "name-character" ? action.character : null;
  if (named === null || chooser === null || named === chooser || !state.cast.includes(named)) {
    return popWindow(state);
  }
  const recorded = patchPending(state, { namedCharacter: named });
  if (chooser === "assassin") return popWindow(kill(recorded, named));
  if (chooser === "witch") return popWindow(bewitch(recorded, named));
  if (chooser === "magistrate") return popWindow(signWarrant(recorded, named));
  return popWindow(recorded);
};
