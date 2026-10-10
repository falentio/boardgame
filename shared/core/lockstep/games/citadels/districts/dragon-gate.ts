import type { DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The Dragon Gate scores only at end of game; the engine never calls it in play. */
export const dragonGate: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** The Dragon Gate's flat end-game bonus. */
const DRAGON_GATE_BONUS = 2;

/** Two extra points whenever the Dragon Gate stands in the city. */
export const dragonGateScoring: DistrictScoring = () => DRAGON_GATE_BONUS;

/** The engine hooks this district responds to; empty means never called. */
export const dragonGateTriggers: readonly DistrictHook[] = [];
