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

/** The seat holding the Bishop this round, falling back to the acting seat. */
const ownerOf = (ctx: CharacterCtx): SeatId => seatHolding(ctx.state, "bishop") ?? ctx.seat;

/** The Bishop's income unit: religious districts in a city. */
const religiousIn = (state: CitadelsState, seat: SeatId): number =>
  playerOf(state, seat).city.filter(
    (district) => typeOfPlaced(district) === "religious",
  ).length;

/**
 * The seat whose districts the rank-8 character may not touch this round, or
 * null when nothing is shielded. The flag is derived, not stored: while the
 * Bishop is in play and un-killed it shields its owner, but a killed Bishop
 * shields no one (rank 8 may target the owner) and a bewitched Bishop shields
 * the Witch instead, leaving the Bishop's own districts open to rank 8.
 */
export const bishopShield = (state: CitadelsState): SeatId | null => {
  const bishop = seatHolding(state, "bishop");
  if (bishop === null) return null;
  if (isSkipped(state, "bishop")) return null;
  if (state.bewitched === "bishop") return seatHolding(state, "witch");
  return bishop;
};

/**
 * Gain 1 gold per religious district in the Bishop's city. A killed Bishop
 * takes no income; a bewitched Bishop's income belongs to the Witch, who plays
 * the turn, so the Bishop adds none here.
 */
export const bishop: CharacterEffect = (ctx) => {
  const owner = ownerOf(ctx);
  if (isSkipped(ctx.state, "bishop") || ctx.state.bewitched === "bishop") {
    return withSteps(ctx.state, ctx.rest);
  }
  return withSteps(addGold(ctx.state, owner, religiousIn(ctx.state, owner)), ctx.rest);
};

/** The Bishop opens no window; a stray call pops and continues. */
export const bishopResolve: WindowResolver = (ctx) => popWindow(ctx.state);
