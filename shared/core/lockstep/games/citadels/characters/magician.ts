import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import {
  actionOf,
  deckDraw,
  emptyPending,
  hasSeat,
  isResigned,
  playerOf,
  withPending,
  withPlayer,
  withSteps,
  winStep,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/**
 * The Magician picks one of two abilities: swap its whole hand with another
 * player's, or discard cards to the bottom of the deck and refill. The effect
 * opens the swap window; declining it offers the discard window.
 */
export const magician: CharacterEffect = (ctx) =>
  withSteps(withPending(ctx.state, emptyPending(ctx.seat, "magician")), [
    winStep("magician-swap", [ctx.seat]),
    ...ctx.rest,
  ]);

const swapHands = (state: CitadelsState, a: SeatId, b: SeatId): CitadelsState => {
  const mine = playerOf(state, a);
  const theirs = playerOf(state, b);
  return withPlayer(
    withPlayer(state, { ...mine, hand: theirs.hand }),
    { ...theirs, hand: mine.hand },
  );
};

/** Move hand card `index` to the bottom of the deck, then draw one from the top. */
const discardOne = (state: CitadelsState, seat: SeatId, index: number): CitadelsState | null => {
  const player = playerOf(state, seat);
  const card = player.hand[index];
  if (card === undefined) return null;
  const hand = player.hand.filter((_, i) => i !== index);
  const stocked = withPlayer(state, { ...player, hand });
  const { drawn, deck } = deckDraw({ ...stocked, deck: [...stocked.deck, card] }, 1);
  const refilled = { ...stocked, deck };
  return withPlayer(refilled, { ...playerOf(refilled, seat), hand: [...hand, ...drawn] });
};

export const magicianResolve: WindowResolver = (ctx) => {
  const seat = ctx.window.seats[0] ?? ctx.state.active;
  const rest = ctx.state.steps.slice(1);
  const action = actionOf(ctx.frame, seat);

  if (ctx.window.purpose === "magician-swap") {
    const target = action?.t === "target" ? action.seat : null;
    if (
      target !== null &&
      target !== seat &&
      hasSeat(ctx.state, target) &&
      !isResigned(ctx.state, target)
    ) {
      return withSteps(withPending(swapHands(ctx.state, seat, target), null), rest);
    }
    return withSteps(ctx.state, [winStep("magician-discard", [seat]), ...rest]);
  }

  const index = action?.t === "keep" ? action.index : -1;
  const discarded =
    Number.isInteger(index) && index >= 0 ? discardOne(ctx.state, seat, index) : null;
  if (discarded === null) return withSteps(withPending(ctx.state, null), rest);
  return withSteps(discarded, [winStep("magician-discard", [seat]), ...rest]);
};
