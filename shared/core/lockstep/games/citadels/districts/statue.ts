import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Statue scores only at end of game; the engine never calls it in play. */
export const statue: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Five extra points when the Statue's owner holds the crown. */
const STATUE_BONUS = 5;

export const statueScoring: DistrictScoring = (_district, _city, seat, state) =>
  state.crown === seat ? STATUE_BONUS : 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const statueBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const statueTriggers: readonly DistrictHook[] = [];
