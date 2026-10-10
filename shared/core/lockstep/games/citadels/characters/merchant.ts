import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { specOfDistrict } from "../districts.ts";
import {
  addGold,
  isSkipped,
  playerOf,
  popWindow,
  seatHolding,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/** The seat holding the Merchant this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "merchant") ?? ctx.seat;

/** The Merchant's income unit: trade districts in a city. */
const tradeIn = (state: CitadelsState, seat: SeatId): number =>
  playerOf(state, seat).city.filter((district) => specOfDistrict(district.id).type === "trade")
    .length;

/**
 * Gain 1 gold per trade district in the Merchant's city, plus 1 extra gold. The
 * bonus does not depend on which resource was gathered this turn. A killed
 * Merchant takes no income; a bewitched Merchant's income belongs to the Witch,
 * who plays the turn.
 */
export const merchant: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  if (isSkipped(ctx.state, "merchant") || ctx.state.bewitched === "merchant") {
    return withSteps(ctx.state, ctx.rest);
  }
  return withSteps(addGold(ctx.state, owner, tradeIn(ctx.state, owner) + 1), ctx.rest);
};

/** The Merchant opens no window; a stray call pops and continues. */
export const merchantResolve: WindowResolver = (ctx) => popWindow(ctx.state);
