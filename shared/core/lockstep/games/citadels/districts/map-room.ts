import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Map Room scores only at end of game; the engine never calls it in play. */
export const mapRoom: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** One extra point for each card left in the owner's hand. */
export const mapRoomScoring: DistrictScoring = (_district, _city, seat, state) =>
  state.players.find((player) => player.seat === seat)?.hand.length ?? 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const mapRoomBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const mapRoomTriggers: readonly DistrictHook[] = [];
