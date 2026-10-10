import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const HAUNTED_QUARTER = "haunted-quarter";

/**
 * At final scoring the Haunted Quarter counts as a district of any one type its
 * owner chooses. The chosen type rides `PlacedDistrict.declaredType`, which
 * `typeOfPlaced` reports to every type reader — the colour bonus above all — so a
 * Haunted Quarter declared noble supplies the noble colour instead of the unique
 * one. A choose-type window carries the owner's choice in `pending.namedType`;
 * with no choice the card counts as its catalog type, unique, the rulebook's
 * default.
 *
 * The engine has no scoring-time hook (`onScoring` is declared but never called),
 * so the choice is recorded before the scoring pass. The choice window that
 * records it is the follow-up this unit reports.
 */
export const hauntedQuarter: DistrictEffect = (ctx: DistrictCtx) => {
  const chosen = ctx.state.pending?.namedType ?? null;
  if (chosen === null) return ctx.state;
  return {
    ...ctx.state,
    players: ctx.state.players.map((player) =>
      player.seat !== ctx.owner
        ? player
        : {
            ...player,
            city: player.city.map((district) =>
              district.id === HAUNTED_QUARTER ? { ...district, declaredType: chosen } : district,
            ),
          },
    ),
  };
};

/** The Haunted Quarter carries no end-game points of its own; its choice rides `typeOfPlaced`. */
export const hauntedQuarterScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const hauntedQuarterBuild: BuildQuery = () => ({});

/** The Haunted Quarter's type choice is recorded by a window; the engine never calls it in play. */
export const hauntedQuarterTriggers: readonly DistrictHook[] = [];
