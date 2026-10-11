import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import {
  addGold,
  drawIntoHand,
  isSkipped,
  NAVIGATOR_CARDS_NOTE,
  popWindow,
  seatHolding,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState, Step } from "../state.ts";

/** The Navigator's two gains: four gold, or four cards. */
export const NAVIGATOR_GOLD = 4;
export const NAVIGATOR_CARDS = 4;

export type NavigatorGain = "gold" | "cards";

/**
 * The `pending.note` marker that selects the four-card branch over the four-gold
 * one. It lives in the engine (`helpers.ts`) because `applyCall`/`resolveTurn`
 * arm it: the Navigator's turn window is its gain choice, and the resolver writes
 * the marker the effect below it reads. Re-exported here so the character's own
 * unit test keeps importing it from its file.
 */
export { NAVIGATOR_CARDS_NOTE };

/** The seat holding the Navigator this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "navigator") ?? ctx.seat;

/** Take four gold, or draw four cards into hand. */
export const navigatorGain = (
  state: CitadelsState,
  seat: SeatId,
  gain: NavigatorGain,
): CitadelsState =>
  gain === "cards" ? drawIntoHand(state, seat, NAVIGATOR_CARDS) : addGold(state, seat, NAVIGATOR_GOLD);

/**
 * The Navigator's choice rides `pending.note`: the engine's turn window records
 * the four-card marker when the seat draws, and the effect below the resolve step
 * reads it. An absent or unrecognised note takes the four-gold branch.
 */
export const navigatorChoice = (state: CitadelsState): NavigatorGain =>
  state.pending?.note === NAVIGATOR_CARDS_NOTE ? "cards" : "gold";

/**
 * The Navigator may build nothing at all. The engine's build opportunities are
 * the `turn` window (the limit build) and an extra-build window such as
 * `trader-build` (a build that would not count toward the limit), so the
 * Navigator's turn carries neither: no build, not even a non-counting one.
 */
export const withoutBuild = (steps: readonly Step[], seat: SeatId): readonly Step[] =>
  steps.filter(
    (step) =>
      !(
        step.kind === "window" &&
        (step.window.purpose === "turn" || step.window.purpose === "trader-build") &&
        step.window.seats.includes(seat)
      ),
  );

/**
 * Gain four gold or four cards — chosen independently of the turn's gather — then
 * take a turn that cannot build. A killed Navigator takes no turn; a bewitched one
 * is played by the Witch, so neither gains nor drops the build window here.
 */
export const navigator: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  if (isSkipped(ctx.state, "navigator") || ctx.state.bewitched === "navigator") {
    return withSteps(ctx.state, ctx.rest);
  }
  const gained = navigatorGain(ctx.state, owner, navigatorChoice(ctx.state));
  return withSteps(gained, withoutBuild(ctx.rest, owner));
};

/** The Navigator opens no character-owned window; a stray call pops and continues. */
export const navigatorResolve: WindowResolver = (ctx) => popWindow(ctx.state);
