import { type CharacterId } from "../characters.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import {
  emptyPending,
  END_TURN,
  popWindow,
  resolveChooseCharacter,
  winStep,
  withPending,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/** Tags the assassin's in-flight commit so its second pass is distinguishable. */
const NAME_NOTE = "assassin-name";

/** The Assassin may kill another character in the cast, never itself. */
export const canKill = (state: CitadelsState, character: CharacterId): boolean =>
  character !== "assassin" && state.cast.includes(character);

/**
 * Call the name of another character. The first pass arms the commit and opens
 * the choose-character window; the second pass, reached after that window
 * resolves, records the kill in `skipped`, which `applyCall` honors when the
 * killed character's rank is reached, so it takes no turn and is never revealed.
 */
export const assassin: CharacterEffect = (ctx: CharacterCtx) => {
  const { state, seat, rest } = ctx;
  const pending = state.pending;
  const committing =
    pending !== null && pending.character === "assassin" && pending.note === NAME_NOTE;
  if (committing) {
    const named = pending.namedCharacter;
    const cleared = withPending(state, null);
    if (named === null || !canKill(state, named)) return withSteps(cleared, rest);
    return withSteps({ ...cleared, skipped: [...state.skipped, named] }, rest);
  }
  const armed = withPending(state, { ...emptyPending(seat, "assassin"), note: NAME_NOTE });
  return withSteps(armed, [
    winStep("choose-character", []),
    { kind: "resolve" },
    winStep("turn", [seat]),
    END_TURN,
    ...rest,
  ]);
};

/**
 * The registry keys the whole `choose-character` purpose to this export, and the
 * Thief, Witch, and Magistrate name through that same window, so it records the
 * name generically and each owner's effect applies its own side effect.
 */
export const assassinResolve: WindowResolver = (ctx) =>
  ctx.window.purpose === "choose-character" ? resolveChooseCharacter(ctx) : popWindow(ctx.state);
