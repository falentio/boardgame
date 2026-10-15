import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { typeOfPlaced } from "../districts.ts";
import {
  drawIntoHand,
  isSkipped,
  playerOf,
  popWindow,
  seatHolding,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/** The seat holding the Patrician this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "patrician") ?? ctx.seat;

/** The Patrician income unit: noble districts in a city. */
const noblesIn = (state: CitadelsState, seat: SeatId): number =>
  playerOf(state, seat).city.filter((district) => typeOfPlaced(district) === "noble").length;

/**
 * Gain 1 card per noble district, then take the crown. A killed Patrician draws
 * no cards but still takes the crown as heir; a bewitched Patrician loses the
 * turn draws to the Witch yet still takes the crown.
 */
export const patrician: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  const crowned = { ...ctx.state, crown: owner };
  if (isSkipped(ctx.state, "patrician") || ctx.state.bewitched === "patrician") {
    return withSteps(crowned, ctx.rest);
  }
  return withSteps(drawIntoHand(crowned, owner, noblesIn(ctx.state, owner)), ctx.rest);
};

/** The Patrician opens no window; a stray call pops and continues. */
export const patricianResolve: WindowResolver = (ctx) => popWindow(ctx.state);
