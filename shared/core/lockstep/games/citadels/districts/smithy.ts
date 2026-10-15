import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { CitadelsState } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The gold the Smithy charges for the three cards. */
const PRICE = 2;
/** How many cards the Smithy draws. */
const DRAW = 3;

/**
 * Once per turn you may pay 2 gold to draw 3 cards from the deck. The engine
 * calls this on the end-of-turn hook, so it fires at most once a turn. It takes
 * the cards off the top of the hidden deck; a deck holding fewer than three
 * yields what remains.
 *
 * This file mutates state directly rather than importing the helpers: helpers.ts
 * imports effects.ts, so a runtime import back into helpers.ts would close a
 * cycle and leave this effect undefined in the registry.
 */
const drawForGold = (state: CitadelsState, owner: DistrictCtx["owner"]): CitadelsState => {
  const player = state.players.find((entry) => entry.seat === owner);
  if (player === undefined || player.gold < PRICE) return state;
  const count = Math.max(0, Math.min(DRAW, state.deck.length));
  const drawn = state.deck.slice(0, count);
  return {
    ...state,
    deck: state.deck.slice(count),
    players: state.players.map((entry) =>
      entry.seat === owner
        ? { ...entry, gold: entry.gold - PRICE, hand: [...entry.hand, ...drawn] }
        : entry,
    ),
  };
};

export const smithy: DistrictEffect = (ctx: DistrictCtx) => drawForGold(ctx.state, ctx.owner);

/** The Smithy carries no end-game points of its own. */
export const smithyScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const smithyBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const smithyTriggers: readonly DistrictHook[] = ["onEndTurn"];
