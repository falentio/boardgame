import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { specOfDistrict } from "../districts.ts";
import {
  actionOf,
  addGold,
  emptyPending,
  isSkipped,
  liveSeats,
  nextSeat,
  playerOf,
  popWindow,
  seatHolding,
  transferGold,
  winStep,
  withPending,
  withPlayer,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "emperor") ?? ctx.seat;

/** The Emperor income unit: noble districts in a city. */
const noblesIn = (state: CitadelsState, seat: SeatId): number =>
  playerOf(state, seat).city.filter((district) => specOfDistrict(district.id).type === "noble").length;

/** The live seats the crown may be handed to: everyone but the Emperor. */
const recipients = (state: CitadelsState, emperor: SeatId): readonly SeatId[] =>
  liveSeats(state).filter((seat) => seat !== emperor);

/**
 * Gain 1 gold per noble district, then open the crown window: the Emperor takes
 * the crown and hands it to a different player, taking 1 gold or 1 random card.
 * Killed: at end of round the Emperor takes the crown and passes it on, taking
 * nothing. Not usable in 2-player games.
 */
export const emperor: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  if (liveSeats(ctx.state).length <= 2) return withSteps(ctx.state, ctx.rest);
  if (recipients(ctx.state, owner).length === 0) return withSteps(ctx.state, ctx.rest);

  if (isSkipped(ctx.state, "emperor")) {
    return withSteps({ ...ctx.state, crown: nextSeat(ctx.state, owner) }, ctx.rest);
  }

  const paid = addGold(ctx.state, owner, noblesIn(ctx.state, owner));
  const opened = withPending(
    { ...paid, crown: owner },
    { ...emptyPending(owner, "emperor"), note: "emperor-target" },
  );
  return withSteps(opened, [winStep("emperor-crown", [owner]), ...ctx.rest]);
};

const takeRandomCard = (
  state: CitadelsState,
  roll: (maxExclusive: number) => number,
  from: SeatId,
  to: SeatId,
): CitadelsState => {
  const hand = playerOf(state, from).hand;
  if (hand.length === 0) return state;
  const index = roll(hand.length);
  const card = hand[index];
  if (card === undefined) return state;
  const source = playerOf(state, from);
  const next = withPlayer(state, { ...source, hand: hand.filter((_, i) => i !== index) });
  const dest = playerOf(next, to);
  return withPlayer(next, { ...dest, hand: [...dest.hand, card] });
};

/** Stage one: the Emperor names the recipient, who must not be the Emperor. */
const resolveTarget = (
  ctx: Parameters<WindowResolver>[0],
  owner: SeatId,
  action: ReturnType<typeof actionOf>,
): CitadelsState => {
  const candidates = recipients(ctx.state, owner);
  const wanted = action?.t === "target" ? action.seat : null;
  const target = wanted !== null && candidates.includes(wanted) ? wanted : candidates[0];
  if (target === undefined) return popWindow(ctx.state);
  const next = withPending(
    { ...ctx.state, crown: target },
    { ...emptyPending(owner, "emperor"), target, note: "emperor-reward" },
  );
  return withSteps(next, [winStep("emperor-crown", [owner]), ...ctx.state.steps.slice(1)]);
};

/** Stage two: the Emperor takes 1 gold, or 1 random card from the recipient hand. */
const resolveReward = (
  ctx: Parameters<WindowResolver>[0],
  owner: SeatId,
  action: ReturnType<typeof actionOf>,
): CitadelsState => {
  const target = ctx.state.pending?.target ?? null;
  if (target === null) return popWindow(ctx.state);
  const taken =
    action?.t === "draw"
      ? takeRandomCard(ctx.state, ctx.rng.int.bind(ctx.rng), target, owner)
      : transferGold(ctx.state, target, owner, 1);
  return popWindow(withPending(taken, null));
};

/** Resolve the two emperor-crown stages, distinguished by pending.note. */
export const emperorResolve: WindowResolver = (ctx) => {
  const owner = seatHolding(ctx.state, "emperor") ?? ctx.window.seats[0] ?? ctx.state.active;
  const action = actionOf(ctx.frame, owner);
  return ctx.state.pending?.note === "emperor-reward"
    ? resolveReward(ctx, owner, action)
    : resolveTarget(ctx, owner, action);
};
