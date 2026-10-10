import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { PlacedDistrict } from "../state.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const MONUMENT_ID = "monument";

/** Five districts in the city already forbid the Monument ("five or more"). */
const FIVE_DISTRICTS = 5;

/**
 * You cannot build the Monument if your city already has five or more districts.
 * The engine folds every unique already in the builder's city and then the card
 * being built, so this query must answer only for the Monument itself; a city
 * card that is a Monument would otherwise gate every later build. `ctx.city` is
 * the builder's city as it stands before this build, so five or more there means
 * the Monument may not join it, and the engine refuses before gold or a hand card
 * moves.
 */
export const monumentBuild: BuildQuery = (ctx) =>
  ctx.card === MONUMENT_ID && ctx.city.length >= FIVE_DISTRICTS ? { legal: false } : {};

/**
 * The extra districts the Monument adds to the end-of-game count. The Monument
 * counts as two, so each one contributes one beyond its own placed card; a
 * city's end-game district count is `city.length + monumentExtraDistricts(city)`.
 * No engine reader consults this yet; see the unit report for the district-count
 * call site (the completed-city check in `applyEndRound`) it needs.
 */
export const monumentExtraDistricts = (city: readonly PlacedDistrict[]): number =>
  city.filter((district) => district.id === MONUMENT_ID).length;

/** The Monument's rule is the count query above; building it mutates no state. */
export const monument: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** The Monument carries no end-game points of its own; its rule is a district count. */
export const monumentScoring: DistrictScoring = () => 0;

/** The Monument's own build is what its build query gates. */
export const monumentTriggers: readonly DistrictHook[] = ["onBuild"];
