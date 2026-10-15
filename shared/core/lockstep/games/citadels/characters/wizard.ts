import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { specOfDistrict, type DistrictId } from "../districts.ts";
import {
  actionOf,
  emptyPending,
  hasSeat,
  isResigned,
  patchPending,
  playerOf,
  tryBuild,
  withPending,
  withPlayer,
  withSteps,
  winStep,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/**
 * The Wizard picks a rival, looks at that hand, and takes one card. The card
 * goes to the Wizard's hand; the Wizard may instead pay to build it at once,
 * which does not consume the turn's own build.
 */
export const wizard: CharacterEffect = (ctx) =>
  withSteps(withPending(ctx.state, emptyPending(ctx.seat, "wizard")), [
    winStep("wizard-take", [ctx.seat]),
    ...ctx.rest,
  ]);

/** Lift hand card `index` from `from` into `to`'s hand; null when out of range. */
const moveCard = (
  state: CitadelsState,
  from: SeatId,
  to: SeatId,
  index: number,
): CitadelsState | null => {
  const source = playerOf(state, from);
  const card = source.hand[index];
  if (card === undefined) return null;
  const stripped = withPlayer(state, {
    ...source,
    hand: source.hand.filter((_, i) => i !== index),
  });
  const receiver = playerOf(stripped, to);
  return withPlayer(stripped, { ...receiver, hand: [...receiver.hand, card] });
};

const builtCard = (state: CitadelsState, seat: SeatId): DistrictId | undefined => {
  const hand = playerOf(state, seat).hand;
  return hand[hand.length - 1];
};

export const wizardResolve: WindowResolver = (ctx) => {
  const seat = ctx.window.seats[0] ?? ctx.state.active;
  const rest = ctx.state.steps.slice(1);
  const action = actionOf(ctx.frame, seat);
  const pending = ctx.state.pending;

  if (pending === null || pending.target === null) {
    const target = action?.t === "target" ? action.seat : null;
    const legal =
      target !== null &&
      target !== seat &&
      hasSeat(ctx.state, target) &&
      !isResigned(ctx.state, target);
    if (!legal) return withSteps(withPending(ctx.state, null), rest);
    return withSteps(patchPending(ctx.state, { target }), [
      winStep("wizard-take", [seat]),
      ...rest,
    ]);
  }

  const index = action?.t === "keep" ? action.index : action?.t === "build" ? action.card : -1;
  const taken = Number.isInteger(index) && index >= 0 ? moveCard(ctx.state, pending.target, seat, index) : null;
  if (taken === null) return withSteps(withPending(ctx.state, null), rest);

  const card = builtCard(taken, seat);
  const builder = playerOf(taken, seat);
  if (
    action?.t === "build" &&
    card !== undefined &&
    builder.gold >= specOfDistrict(card).cost
  ) {
    const built = tryBuild(taken, seat, builder.hand.length - 1, ctx.rng);
    return withSteps(withPending(built, null), [...built.steps, ...rest]);
  }
  return withSteps(withPending(taken, null), rest);
};
