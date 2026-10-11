import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { typeOfPlaced, type DistrictId } from "../districts.ts";
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
 * the donor (never more than the donor holds) and give that player one card from
 * the Cardinal's hand per gold taken, up to the cards it can spare. `reserve`
 * names the district being built, which stays in hand for the retry. The donor
 * cannot refuse, and the Cardinal cannot take more than needed.
 */
export const coverShortfall = (
  state: CitadelsState,
  builder: SeatId,
  donor: SeatId,
  shortfall: number,
  reserve?: DistrictId,
): CitadelsState => {
  if (builder === donor) return state;
  const payer = playerOf(state, builder);
  const source = playerOf(state, donor);
  const taken = Math.max(0, Math.min(shortfall, source.gold));
  if (taken <= 0) return state;
  // Hand cards out one per gold taken, skipping the reserve: each unit of the
  // gift removes exactly one card of that id, so a hand holding two copies of an
  // id loses one card per unit given, not every copy (id-based filtering would
  // collapse them and destroy the rest).
  const given: DistrictId[] = [];
  const kept: DistrictId[] = [];
  for (const id of payer.hand) {
    if (id === reserve || given.length >= taken) kept.push(id);
    else given.push(id);
  }
  const paidBuilder = withPlayer(state, { ...payer, gold: payer.gold + taken, hand: kept });
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
 * Resolve the cardinal-gold window. The engine opens it twice: once on the
 * income pass (amount 0, a pass), and once when a build falls short, carrying the
 * gap in `pending.amount` and the district in `pending.cards[0]`. The Cardinal
 * names a donor and the gap is covered from it; the turn window below then
 * retries the build. Naming nobody, or a zero amount, is a pass.
 */
export const cardinalResolve: WindowResolver = (ctx) => {
  const owner = seatHolding(ctx.state, "cardinal") ?? ctx.window.seats[0] ?? ctx.state.active;
  const action = actionOf(ctx.frame, owner);
  const donor = action?.t === "target" ? action.seat : null;
  const pending = ctx.state.pending;
  const shortfall = pending?.amount ?? 0;
  if (donor === null || shortfall <= 0) return popWindow(withPending(ctx.state, null));
  const reserve = pending?.cards[0];
  const covered = coverShortfall(ctx.state, owner, donor, shortfall, reserve);
  return popWindow(withPending(covered, null));
};
