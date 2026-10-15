import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import {
  drawIntoHand,
  isSkipped,
  popWindow,
  seatHolding,
  winStep,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { Step } from "../state.ts";

/** The two cards the Architect draws beyond the turn's gather. */
export const ARCHITECT_EXTRA_CARDS = 2;

/** The Architect may build up to three districts this turn. */
export const ARCHITECT_BUILD_LIMIT = 3;

/** The seat holding the Architect this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "architect") ?? ctx.seat;

/**
 * The engine's only build-capable window is `turn`, one per turn by default, so a
 * character's building limit is the number of `turn` windows its turn carries.
 * The Architect replaces the round's single window with three, which is the whole
 * of "your building limit this turn is three".
 */
export const withBuildLimit = (
  steps: readonly Step[],
  seat: SeatId,
  limit: number,
): readonly Step[] => {
  const others = steps.filter(
    (step) => !(step.kind === "window" && step.window.purpose === "turn"),
  );
  const turns: readonly Step[] = Array.from({ length: Math.max(0, limit) }, () =>
    winStep("turn", [seat]),
  );
  return [...turns, ...others];
};

/**
 * Gain two extra cards, then take a turn with three build opportunities. The draw
 * never reads the gather, so it lands whether the Architect took gold or drew
 * cards. A killed Architect takes no turn; a bewitched one is played by the Witch,
 * so neither draws here.
 */
export const architect: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  if (isSkipped(ctx.state, "architect") || ctx.state.bewitched === "architect") {
    return withSteps(ctx.state, ctx.rest);
  }
  const drawn = drawIntoHand(ctx.state, owner, ARCHITECT_EXTRA_CARDS);
  return withSteps(drawn, withBuildLimit(ctx.rest, owner, ARCHITECT_BUILD_LIMIT));
};

/** The Architect opens no character-owned window; a stray call pops and continues. */
export const architectResolve: WindowResolver = (ctx) => popWindow(ctx.state);
