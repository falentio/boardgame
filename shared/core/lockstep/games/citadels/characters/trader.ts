import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { specOfDistrict } from "../districts.ts";
import {
  actionOf,
  addGold,
  isSkipped,
  playerOf,
  seatHolding,
  tryBuild,
  winStep,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/** The seat holding the Trader this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "trader") ?? ctx.seat;

/** The Trader's income unit: trade districts in a city. */
const tradeIn = (state: CitadelsState, seat: SeatId): number =>
  playerOf(state, seat).city.filter((district) => specOfDistrict(district.id).type === "trade")
    .length;

/**
 * Gain 1 gold per trade district, then open the trader-build window: the Trader
 * may build any number of trade districts, which do not count toward the turn's
 * building limit, so the normal turn window stays below for the limit build. A
 * killed Trader takes no income; a bewitched one is played by the Witch.
 */
export const trader: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  if (isSkipped(ctx.state, "trader") || ctx.state.bewitched === "trader") {
    return withSteps(ctx.state, ctx.rest);
  }
  const paid = addGold(ctx.state, owner, tradeIn(ctx.state, owner));
  return withSteps(paid, [winStep("trader-build", [owner]), ...ctx.rest]);
};

/**
 * Resolve the trader-build window. A trade district the Trader can afford is
 * built and the window reopens, so the Trader keeps building; anything else —
 * a pass, a non-trade district, or a card the Trader cannot pay for — closes it
 * and the turn continues below.
 */
export const traderResolve: WindowResolver = (ctx) => {
  const seat = ctx.window.seats[0] ?? ctx.state.active;
  const rest = ctx.state.steps.slice(1);
  const action = actionOf(ctx.frame, seat);
  if (action?.t !== "build") return withSteps(ctx.state, rest);
  const id = playerOf(ctx.state, seat).hand[action.card];
  if (id === undefined || specOfDistrict(id).type !== "trade") return withSteps(ctx.state, rest);
  const built = tryBuild(ctx.state, seat, action.card, ctx.rng);
  const grew = playerOf(built, seat).city.length > playerOf(ctx.state, seat).city.length;
  if (!grew) return withSteps(ctx.state, rest);
  return withSteps(built, [...built.steps, winStep("trader-build", [seat]), ...rest]);
};
