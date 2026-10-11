import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { typeOfPlaced } from "../districts.ts";
import {
  actionOf,
  drawIntoHand,
  emptyPending,
  isSkipped,
  playerOf,
  popWindow,
  seatHolding,
  winStep,
  withPending,
  withPlayer,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/** The seat holding the Cardinal this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "cardinal") ?? ctx.seat;

/** The Cardinal's income unit: religious districts in a city. */
const religiousIn = (state: CitadelsState, seat: SeatId): number =>
  playerOf(state, seat).city.filter(
    (district) => typeOfPlaced(district) === "religious",
  ).length;

/** The gold the Cardinal still needs to pay for a district of the given cost. */
export const cardinalShortfall = (state: CitadelsState, seat: SeatId, cost: number): number =>
  Math.max(0, cost - playerOf(state, seat).gold);

/**
 * Cover a build shortfall from one donor: take gold equal to the shortfall from
 * the donor and give them one card from the Cardinal's hand per gold taken. The
 * donor cannot refuse, and the Cardinal cannot take more gold than needed, more
 * than the donor holds, or more than the cards the Cardinal can hand over.
 */
export const coverShortfall = (
  state: CitadelsState,
  builder: SeatId,
  donor: SeatId,
  shortfall: number,
): CitadelsState => {
  if (builder === donor) return state;
  const payer = playerOf(state, builder);
  const source = playerOf(state, donor);
  const taken = Math.max(0, Math.min(shortfall, source.gold, payer.hand.length));
  if (taken <= 0) return state;
  const given = payer.hand.slice(0, taken);
  const paidBuilder = withPlayer(state, {
    ...payer,
    gold: payer.gold + taken,
    hand: payer.hand.slice(taken),
  });
  return withPlayer(paidBuilder, {
    ...source,
    gold: source.gold - taken,
    hand: [...source.hand, ...given],
  });
};

/**
 * Gain 1 card per religious district in the Cardinal's city, then open the
 * cardinal-gold window so the Cardinal may cover a build shortfall. A killed
 * Cardinal takes no income; a bewitched one is played by the Witch.
 */
export const cardinal: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  if (isSkipped(ctx.state, "cardinal") || ctx.state.bewitched === "cardinal") {
    return withSteps(ctx.state, ctx.rest);
  }
  const paid = drawIntoHand(ctx.state, owner, religiousIn(ctx.state, owner));
  const opened = withPending(paid, {
    ...emptyPending(owner, "cardinal"),
    note: "cardinal-gold",
  });
  return withSteps(opened, [winStep("cardinal-gold", [owner]), ...ctx.rest]);
};

/**
 * Resolve the cardinal-gold window: the Cardinal names a donor, and the pending
 * amount is the shortfall to cover. Naming nobody, or a shortfall of zero, is a
 * pass. The donor has no report to give; the transfer is unconditional.
 */
export const cardinalResolve: WindowResolver = (ctx) => {
  const owner = seatHolding(ctx.state, "cardinal") ?? ctx.window.seats[0] ?? ctx.state.active;
  const action = actionOf(ctx.frame, owner);
  const donor = action?.t === "target" ? action.seat : null;
  const shortfall = ctx.state.pending?.amount ?? 0;
  if (donor === null || shortfall <= 0) return popWindow(withPending(ctx.state, null));
  return popWindow(withPending(coverShortfall(ctx.state, owner, donor, shortfall), null));
};
