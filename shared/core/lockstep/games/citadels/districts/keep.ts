import type { BuildQuery, DistrictHook, DistrictId } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/**
 * The Keep is immune to the Warlord's destroy. The clause is a veto, not a state
 * change, so it is a query the destroy path consults: a district whose id this
 * returns true for can never be destroyed.
 */
export const keepProtects = (id: DistrictId): boolean => id === "keep";

/** The Keep's protection is the veto above; it mutates no state. */
export const keep: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** The Keep scores no end-game points of its own. */
export const keepScoring: DistrictScoring = () => 0;

/** This district's pre-build answer; the engine's default terms until its worker fills it in. */
export const keepBuild: BuildQuery = () => ({});

/** The engine hooks this district responds to; empty means never called. */
export const keepTriggers: readonly DistrictHook[] = ["onDestroy"];
