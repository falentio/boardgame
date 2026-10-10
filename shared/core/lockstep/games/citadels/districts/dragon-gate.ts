import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the dragon-gate district's ability is filled in by its own worker. */
export const dragonGate: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for dragon-gate; its own worker fills this in. */
export const dragonGateScoring: DistrictScoring = () => 0;
