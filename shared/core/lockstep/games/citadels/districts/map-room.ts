import type { DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the map-room district's ability is filled in by its own worker. */
export const mapRoom: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for map-room; its own worker fills this in. */
export const mapRoomScoring: DistrictScoring = () => 0;

/** The engine hooks this district responds to; empty means never called. */
export const mapRoomTriggers: readonly DistrictHook[] = [];
