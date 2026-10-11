import type { SeatId } from "../../../index.ts";
import { specOfCharacter, type CharacterId } from "../characters.ts";
import type { BuildQuery, DistrictHook, DistrictType } from "../districts.ts";
import type { CitadelsState } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const SCHOOL_ID = "school-of-magic";

/**
 * The character the rank cursor is playing for `owner` this turn, or null. The
 * engine advances `callRank` past the rank it calls, so the acting character is
 * `callRank - 1`; a seat that drafted two characters plays the one the cursor
 * called, not its first claim. A hand-built state that never ran the cursor falls
 * back to the owner's first claim.
 *
 * Inlined rather than imported from helpers.ts: helpers imports this file (via
 * districts/effects.ts), so a runtime edge back would close the cycle and leave
 * `UNIQUE_EFFECTS["school-of-magic"]` undefined when a test loads this file
 * before the registry (the same reason museum.ts and theater.ts inline theirs).
 */
const actingCharacterOf = (state: CitadelsState, owner: SeatId): CharacterId | null => {
  const played = state.callRank - 1;
  if (played >= 1 && played <= 9) {
    const at = state.cast.find((id) => specOfCharacter(id).rank === played) ?? null;
    if (
      at !== null &&
      state.claimed.some((claim) => claim.character === at && claim.seat === owner)
    ) {
      return at;
    }
  }
  return state.claimed.find((claim) => claim.seat === owner)?.character ?? null;
};

/**
 * The district type the acting character collects income for, or null when it
 * collects none. This is the rulebook's own mapping: "as the King it can count as
 * noble, and so on" — the King counts nobles, the Bishop religious, the Merchant
 * trade, the Warlord military.
 */
const incomeTypeOf = (state: CitadelsState, owner: SeatId): DistrictType | null => {
  const character = actingCharacterOf(state, owner);
  return character === null ? null : specOfCharacter(character).income?.counts ?? null;
};

/** The type a character collects income for, or null when it collects none. */
export const schoolTypeForCharacter = (character: CharacterId): DistrictType | null =>
  specOfCharacter(character).income?.counts ?? null;

/**
 * Record the declared type on the owner's School of Magic, if they hold one. A
 * type named in the pending action (a choose-type window) is the owner's explicit
 * choice; otherwise the type is `fallback`, so a King's School of Magic counts as
 * noble, a Bishop's as religious, and so on. A null choice leaves the card
 * counting as its catalog type.
 */
const recordType = (
  state: CitadelsState,
  owner: SeatId,
  fallback: DistrictType | null,
): CitadelsState => {
  const chosen = state.pending?.namedType ?? fallback;
  if (chosen === null) return state;
  const player = state.players.find((p) => p.seat === owner);
  if (player === undefined || !player.city.some((district) => district.id === SCHOOL_ID)) {
    return state;
  }
  return {
    ...state,
    players: state.players.map((p) =>
      p.seat !== owner
        ? p
        : {
            ...p,
            city: p.city.map((district) =>
              district.id === SCHOOL_ID ? { ...district, declaredType: chosen } : district,
            ),
          },
    ),
  };
};

/**
 * Declare the owner's type at the moment their turn opens, before the character
 * income that reads it runs. The engine's character income sits at the resolve
 * step above the turn window, so a declaration made only on the gather would be
 * one step too late: the colour must be on the card when the income counts it.
 */
export const declareSchoolOfMagic = (
  state: CitadelsState,
  owner: SeatId,
  character: CharacterId,
): CitadelsState => recordType(state, owner, schoolTypeForCharacter(character));

/**
 * During resource gathering the School of Magic counts as a district of any one
 * type its owner chooses. It records that type on its own placed card, which
 * `typeOfPlaced` then reports to every type reader. The gather fires this on the
 * `onIncome` hook; the engine also calls `declareSchoolOfMagic` when a character
 * turn opens, so the character's own income sees the colour.
 */
export const schoolOfMagic: DistrictEffect = (ctx: DistrictCtx) =>
  recordType(ctx.state, ctx.owner, incomeTypeOf(ctx.state, ctx.owner));

/** The School of Magic carries no end-game points of its own. */
export const schoolOfMagicScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const schoolOfMagicBuild: BuildQuery = () => ({});

/** The School of Magic answers the gather-income hook, where it declares its type. */
export const schoolOfMagicTriggers: readonly DistrictHook[] = ["onIncome"];
