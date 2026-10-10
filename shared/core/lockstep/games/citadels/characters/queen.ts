import type { SeatId } from "../../../index.ts";
import type { CharacterCtx, CharacterEffect } from "../characters/index.ts";
import {
  addGold,
  characterAtRank,
  liveSeats,
  popWindow,
  seatHolding,
  withSteps,
  type WindowResolver,
} from "../helpers.ts";
import type { CitadelsState } from "../state.ts";

/** The rank whose revealed owner must sit beside the Queen. */
const CROWN_RANK = 4;

/** The Queen's income: three gold for sitting beside the rank-4 character's owner. */
const ADJACENT_INCOME = 3;

/** The Queen needs a full table; with fewer than five players the ability is dead. */
const MIN_PLAYERS = 5;

/** The seats physically either side of `seat` at the table, by roster order. */
const neighbours = (state: CitadelsState, seat: SeatId): readonly SeatId[] => {
  const order = state.players.map((player) => player.seat);
  const at = order.indexOf(seat);
  if (at < 0 || order.length < 2) return [];
  const size = order.length;
  const prev = order[(at - 1 + size) % size];
  const next = order[(at + 1) % size];
  return [prev, next].filter((candidate): candidate is SeatId => candidate !== undefined);
};

/** The seat holding the rank-4 character this round, or null when nobody does. */
const crownHolder = (state: CitadelsState): SeatId | null => {
  const rank4 = characterAtRank(state, CROWN_RANK);
  return rank4 === null ? null : seatHolding(state, rank4);
};

/**
 * If the Queen sits beside the player who revealed the rank-4 character, she
 * gains three gold. A killed rank-4 character is never revealed on its turn, so
 * the same adjacency pays the Queen when its card is revealed at end of round;
 * either way she collects three gold. The ability is not usable with fewer than
 * five players.
 */
export const queen: CharacterEffect = (ctx) => {
  const seat = seatHolding(ctx.state, "queen") ?? ctx.seat;
  if (liveSeats(ctx.state).length < MIN_PLAYERS) return withSteps(ctx.state, ctx.rest);
  const holder = crownHolder(ctx.state);
  if (holder === null || holder === seat) return withSteps(ctx.state, ctx.rest);
  if (!neighbours(ctx.state, seat).includes(holder)) return withSteps(ctx.state, ctx.rest);
  return withSteps(addGold(ctx.state, seat, ADJACENT_INCOME), ctx.rest);
};

/** The Queen opens no window; a stray call pops and continues. */
export const queenResolve: WindowResolver = (ctx) => popWindow(ctx.state);
