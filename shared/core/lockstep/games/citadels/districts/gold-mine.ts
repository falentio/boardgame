import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { CitadelsState } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The bonus the Gold Mine adds to a gold gather. */
const EXTRA_GOLD = 1;

/**
 * When you choose gold while gathering resources, take 1 extra gold. The engine
 * calls this on the income hook, which only fires when the active player chose
 * gold; a card draw or a build never reaches it.
 *
 * This file mutates state directly rather than importing the helpers: helpers.ts
 * imports effects.ts, so a runtime import back into helpers.ts would close a
 * cycle and leave this effect undefined in the registry.
 */
const grantExtraGold = (state: CitadelsState, owner: DistrictCtx["owner"]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === owner ? { ...player, gold: player.gold + EXTRA_GOLD } : player,
  ),
});

export const goldMine: DistrictEffect = (ctx: DistrictCtx) => grantExtraGold(ctx.state, ctx.owner);

/** The Gold Mine carries no end-game points of its own. */
export const goldMineScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const goldMineBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const goldMineTriggers: readonly DistrictHook[] = ["onIncome"];
