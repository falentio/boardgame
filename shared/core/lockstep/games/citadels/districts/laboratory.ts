import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { CitadelsState } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The gold the Laboratory pays out for the discarded card. */
const REWARD = 2;

/**
 * Once per turn you may discard one card from your hand to take 2 gold. The
 * engine calls this on the end-of-turn hook, so it fires at most once a turn.
 * The hook carries no per-card choice seam, so it discards the hand's first
 * card; the card lands on the public discard pile, which keeps the deck
 * conserved.
 *
 * This file mutates state directly rather than importing the helpers: helpers.ts
 * imports effects.ts, so a runtime import back into helpers.ts would close a
 * cycle and leave this effect undefined in the registry.
 */
const discardFirst = (state: CitadelsState, owner: DistrictCtx["owner"]): CitadelsState => {
  const player = state.players.find((entry) => entry.seat === owner);
  const card = player?.hand[0];
  if (player === undefined || card === undefined) return state;
  return {
    ...state,
    discard: [...state.discard, card],
    players: state.players.map((entry) =>
      entry.seat === owner ? { ...entry, hand: entry.hand.slice(1), gold: entry.gold + REWARD } : entry,
    ),
  };
};

export const laboratory: DistrictEffect = (ctx: DistrictCtx) => discardFirst(ctx.state, ctx.owner);

/** The Laboratory carries no end-game points of its own. */
export const laboratoryScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const laboratoryBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const laboratoryTriggers: readonly DistrictHook[] = ["onEndTurn"];
