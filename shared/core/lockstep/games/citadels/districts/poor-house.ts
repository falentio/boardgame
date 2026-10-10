import type { DistrictHook } from "../districts.ts";
import type { CitadelsState } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The single gold the Poor House takes from the bank. */
const POOR_HOUSE_GOLD = 1;

/**
 * If you have no gold at the end of your turn, take one gold from the bank. The
 * engine calls this on the end-turn hook for the active player, after the turn's
 * gather and build are done.
 *
 * This file mutates state directly rather than importing the helpers: helpers.ts
 * imports effects.ts, so a runtime import back into helpers.ts would close a
 * cycle and leave this effect undefined in the registry.
 */
export const poorHouse: DistrictEffect = (ctx: DistrictCtx) => {
  const player = ctx.state.players.find((candidate) => candidate.seat === ctx.owner);
  if (player === undefined || player.gold > 0) return ctx.state;
  return {
    ...ctx.state,
    players: ctx.state.players.map((candidate) =>
      candidate.seat === ctx.owner
        ? { ...candidate, gold: candidate.gold + POOR_HOUSE_GOLD }
        : candidate,
    ),
  };
};

/** The Poor House carries no end-game points of its own. */
export const poorHouseScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to. */
export const poorHouseTriggers: readonly DistrictHook[] = ["onEndTurn"];
