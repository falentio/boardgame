import type { DistrictHook } from "../districts.ts";
import { specOfDistrict } from "../districts.ts";
import { addGold } from "../helpers.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The discount the Factory applies to each of your other unique districts. */
const DISCOUNT = 1;

/**
 * Your other unique districts cost one less gold to build. The build path
 * charges the catalog cost and commits the district before it runs the onBuild
 * hooks, so the Factory hands one gold back when the district just built is a
 * unique other than the Factory itself.
 */
export const factory: DistrictEffect = (ctx: DistrictCtx) => {
  const built = ctx.city[ctx.city.length - 1];
  if (built === undefined || built.id === "factory") return ctx.state;
  if (!specOfDistrict(built.id).unique) return ctx.state;
  return addGold(ctx.state, ctx.owner, DISCOUNT);
};

/** The Factory carries no end-game points of its own. */
export const factoryScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to. */
export const factoryTriggers: readonly DistrictHook[] = ["onBuild"];
