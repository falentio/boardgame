import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import {
  addGold,
  emptyPending,
  popWindow,
  resolveChooseCharacter,
  seatHolding,
  winStep,
  withPending,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";

/** The Witch's fixed gather, taken before the bewitch. */
const GATHER = 2;

/** Tags the witch's in-flight commit so its second pass is distinguishable. */
const NAME_NOTE = "witch-name";

/**
 * Gather resources, then call the name of another character to bewitch. The turn
 * is put on hold: the effect opens the naming window but no build-capable turn
 * window of its own, so the Witch cannot build. Her turn resumes when the
 * bewitched character is called (see `witchResolve`).
 */
export const witch: CharacterEffect = (ctx: CharacterCtx) => {
  const { state, seat, rest } = ctx;
  const pending = state.pending;
  const committing = pending !== null && pending.character === "witch" && pending.note === NAME_NOTE;
  if (committing) {
    const named = pending.namedCharacter;
    const cleared = withPending(state, null);
    if (named === null || named === "witch" || !state.cast.includes(named)) {
      return withSteps(cleared, rest);
    }
    return withSteps({ ...cleared, bewitched: named }, rest);
  }
  const gathered = addGold(state, seat, GATHER);
  const armed = withPending(gathered, { ...emptyPending(seat, "witch"), note: NAME_NOTE });
  return withSteps(armed, [winStep("choose-character", []), { kind: "resolve" }, ...rest]);
};

/**
 * `witch-takeover` (opened by `applyCall` when the bewitched character is called)
 * gives the bewitched owner its gather and ends its turn at once, then hands the
 * held turn back to the Witch. `witch-resume` opens the Witch's own turn, played
 * with the Witch's hand, gold, and city.
 */
export const witchResolve: WindowResolver = (ctx) => {
  if (ctx.window.purpose !== "witch-takeover" && ctx.window.purpose !== "witch-resume") {
    return popWindow(ctx.state);
  }
  const rest = ctx.state.steps.slice(1);
  const witchSeat = ctx.window.seats[0] ?? seatHolding(ctx.state, "witch");
  if (witchSeat === undefined || witchSeat === null) return withSteps(ctx.state, rest);
  if (ctx.window.purpose === "witch-resume") {
    return withSteps({ ...ctx.state, active: witchSeat }, [winStep("turn", [witchSeat]), ...rest]);
  }
  const bewitched = ctx.state.bewitched ?? null;
  const bewitchedSeat = bewitched === null ? null : seatHolding(ctx.state, bewitched);
  const gathered = bewitchedSeat === null ? ctx.state : addGold(ctx.state, bewitchedSeat, GATHER);
  return withSteps(gathered, [winStep("witch-resume", [witchSeat]), ...rest]);
};
