import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { PlacedDistrict } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/**
 * The toll the Great Wall adds to a destroy: one extra gold when the city being
 * destroyed from holds the Great Wall. The Great Wall taxes the whole city, so
 * the toll is a property of the city, not of one card.
 */
export const greatWallToll = (city: readonly PlacedDistrict[]): number =>
  city.some((district) => district.id === "great-wall") ? 1 : 0;

/**
 * The toll a Diplomat owes to exchange. Only the district taken is tolled, so
 * the toll reads the rival's city; the district given from the Diplomat's own
 * city is never tolled, even when that city holds a Great Wall.
 */
export const greatWallExchangeToll = (
  takenCity: readonly PlacedDistrict[],
  givenCity: readonly PlacedDistrict[],
): number => {
  void givenCity;
  return greatWallToll(takenCity);
};

/** The Great Wall's toll is the query above; it mutates no state. */
export const greatWall: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** The Great Wall scores no end-game points of its own. */
export const greatWallScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const greatWallBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const greatWallTriggers: readonly DistrictHook[] = ["onDestroy"];
