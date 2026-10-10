import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** At most two copies of a district may stand: the original and one duplicate. */
const DUPLICATE_CAP = 2;

/**
 * The Quarry lets its owner hold a duplicate: a district identical to one
 * already in the city may be built while the Quarry stands. The rulebook caps
 * this at one duplicate per district, so a build that would add a third copy of
 * a district is refused. The build path folds this query while the Quarry is in
 * the city, so the cap applies to its owner's builds.
 */
export const quarryBuild: BuildQuery = (ctx) => {
  const copies = ctx.city.filter((district) => district.id === ctx.card).length;
  return copies >= DUPLICATE_CAP ? { legal: false } : {};
};

/** The Quarry's ability is the build query above; the onBuild hook changes nothing. */
export const quarry: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** The Quarry scores no end-game points of its own. */
export const quarryScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to; empty means never called. */
export const quarryTriggers: readonly DistrictHook[] = ["onBuild"];
