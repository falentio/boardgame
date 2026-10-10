import type { DistrictHook } from "../districts.ts";
import type { CitadelsState } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The two cards the Park draws for an empty hand. */
const PARK_DRAW = 2;

/**
 * If you have no cards in hand at the end of your turn, draw two cards. The
 * engine calls this on the end-turn hook for the active player, after the turn's
 * gather and build are done.
 *
 * This file mutates state directly rather than importing the helpers: helpers.ts
 * imports effects.ts, so a runtime import back into helpers.ts would close a
 * cycle and leave this effect undefined in the registry.
 */
const drawTwo = (state: CitadelsState, seat: DistrictCtx["owner"]): CitadelsState => {
  const count = Math.max(0, Math.min(PARK_DRAW, state.deck.length));
  const drawn = state.deck.slice(0, count);
  const deck = state.deck.slice(count);
  return {
    ...state,
    deck,
    players: state.players.map((player) =>
      player.seat === seat ? { ...player, hand: [...player.hand, ...drawn] } : player,
    ),
  };
};

export const park: DistrictEffect = (ctx: DistrictCtx) => {
  const player = ctx.state.players.find((candidate) => candidate.seat === ctx.owner);
  if (player === undefined || player.hand.length > 0) return ctx.state;
  return drawTwo(ctx.state, ctx.owner);
};

/** The Park carries no end-game points of its own. */
export const parkScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to. */
export const parkTriggers: readonly DistrictHook[] = ["onEndTurn"];
