import { seatId, type Random, type SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import {
  actionOf,
  emptyPending,
  liveSeats,
  patchPending,
  playerOf,
  withPending,
  withPlayer,
  withSteps,
  winStep,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/**
 * The Seer takes one card at random from every other player with a hand, then
 * hands one card back to each of those players. The take order is fixed at the
 * start (the recipients ride in `pending.note`); `pending.amount` is the cursor
 * through the receive phase and, reset to zero, through the give phase.
 */
export const seer: CharacterEffect = (ctx) => {
  const recipients = liveSeats(ctx.state).filter(
    (seat) => seat !== ctx.seat && playerOf(ctx.state, seat).hand.length > 0,
  );
  const pending = { ...emptyPending(ctx.seat, "seer"), note: recipients.join(",") };
  const state = withPending(ctx.state, pending);
  if (recipients.length === 0) return withSteps(state, ctx.rest);
  return withSteps(state, [winStep("seer-receive", [ctx.seat]), ...ctx.rest]);
};

const splitNote = (note: string | null): readonly SeatId[] =>
  (note ?? "")
    .split(",")
    .filter((seat) => seat.length > 0)
    .map(seatId);

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

const takeRandom = (state: CitadelsState, from: SeatId, to: SeatId, rng: Random): CitadelsState => {
  const hand = playerOf(state, from).hand;
  if (hand.length === 0) return state;
  return moveCard(state, from, to, rng.int(hand.length)) ?? state;
};

export const seerResolve: WindowResolver = (ctx) => {
  const seer = ctx.window.seats[0] ?? ctx.state.active;
  const rest = ctx.state.steps.slice(1);
  const pending = ctx.state.pending;
  if (pending === null) return withSteps(ctx.state, rest);

  const recipients = splitNote(pending.note);
  const recipient = recipients[pending.amount];
  if (recipient === undefined) return withSteps(withPending(ctx.state, null), rest);

  if (ctx.window.purpose === "seer-receive") {
    const taken = takeRandom(ctx.state, recipient, seer, ctx.rng);
    const advanced = patchPending(taken, { amount: pending.amount + 1 });
    if (pending.amount + 1 < recipients.length) {
      return withSteps(advanced, [winStep("seer-receive", [seer]), ...rest]);
    }
    return withSteps(patchPending(advanced, { amount: 0 }), [winStep("seer-give", [seer]), ...rest]);
  }

  const hand = playerOf(ctx.state, seer).hand;
  const action = actionOf(ctx.frame, seer);
  const wanted = action?.t === "keep" ? action.index : 0;
  const index = Number.isInteger(wanted) && wanted >= 0 && wanted < hand.length ? wanted : 0;
  const given = moveCard(ctx.state, seer, recipient, index) ?? ctx.state;
  const advanced = patchPending(given, { amount: pending.amount + 1 });
  if (pending.amount + 1 < recipients.length) {
    return withSteps(advanced, [winStep("seer-give", [seer]), ...rest]);
  }
  return withSteps(withPending(advanced, null), rest);
};
