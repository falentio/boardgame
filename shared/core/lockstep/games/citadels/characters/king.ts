import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import { typeOfPlaced } from "../districts.ts";
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

/** The seat holding the King this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "king") ?? ctx.seat;

/** The King's income unit: noble districts in a city. */
const noblesIn = (state: CitadelsState, seat: SeatId): number =>
  playerOf(state, seat).city.filter((district) => typeOfPlaced(district) === "noble").length;

/**
 * Gain 1 gold per noble district, then take the crown. A killed King takes no
 * income but still takes the crown as heir; a bewitched King loses the turn's
 * income to the Witch yet still takes the crown.
 */
export const king: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  const crowned = { ...ctx.state, crown: owner };
  if (isSkipped(ctx.state, "king") || ctx.state.bewitched === "king") {
    return withSteps(crowned, ctx.rest);
  }
  return withSteps(addGold(crowned, owner, noblesIn(ctx.state, owner)), ctx.rest);
};

/** The King opens no window; a stray call pops and continues. */
export const kingResolve: WindowResolver = (ctx) => popWindow(ctx.state);
