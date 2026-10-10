import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Imperial Treasury scores only at end of game; the engine never calls it in play. */
export const imperialTreasury: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** One extra point for each gold in the owner's stash. */
export const imperialTreasuryScoring: DistrictScoring = (_district, _city, seat, state) =>
  state.players.find((player) => player.seat === seat)?.gold ?? 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const imperialTreasuryBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const imperialTreasuryTriggers: readonly DistrictHook[] = [];
