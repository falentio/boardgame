import type { SeatId } from "../../../index.ts";
import { specOfCharacter } from "../characters.ts";
import type { BuildQuery, DistrictHook, DistrictType } from "../districts.ts";
import type { CitadelsState } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const SCHOOL_ID = "school-of-magic";

/**
 * The district type the owner's character collects income for, or null when the
 * character collects none. This is the rulebook's own mapping: "as the King it
 * can count as noble, and so on" — the King counts nobles, the Bishop religious,
 * the Merchant trade, the Warlord military.
 */
const incomeTypeOf = (state: CitadelsState, owner: SeatId): DistrictType | null => {
  const claim = state.claimed.find((entry) => entry.seat === owner);
  if (claim === undefined) return null;
  return specOfCharacter(claim.character).income?.counts ?? null;
};

/**
 * During resource gathering the School of Magic counts as a district of any one
 * type its owner chooses. It records that type on its own placed card, which
 * `typeOfPlaced` then reports to every type reader. A type named in the pending
 * action (a choose-type window) is the owner's explicit choice; otherwise the
 * type is the one the owner's character collects income for, so a King's School
 * of Magic counts as noble, a Bishop's as religious, and so on. A character that
 * collects no income leaves the card counting as its catalog type.
 *
 * The gather fires this on the `onIncome` hook, so the declaration lands at the
 * moment the rule names. The engine's gather has no type reader of its own yet;
 * see the unit report for the income-counting call site this needs.
 */
export const schoolOfMagic: DistrictEffect = (ctx: DistrictCtx) => {
  const chosen = ctx.state.pending?.namedType ?? incomeTypeOf(ctx.state, ctx.owner);
  if (chosen === null) return ctx.state;
  return {
    ...ctx.state,
    players: ctx.state.players.map((player) =>
      player.seat !== ctx.owner
        ? player
        : {
            ...player,
            city: player.city.map((district) =>
              district.id === SCHOOL_ID ? { ...district, declaredType: chosen } : district,
            ),
          },
    ),
  };
};

/** The School of Magic carries no end-game points of its own. */
export const schoolOfMagicScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const schoolOfMagicBuild: BuildQuery = () => ({});

/** The School of Magic answers the gather-income hook, where it declares its type. */
export const schoolOfMagicTriggers: readonly DistrictHook[] = ["onIncome"];
