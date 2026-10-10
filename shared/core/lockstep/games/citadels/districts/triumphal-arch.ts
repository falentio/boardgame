import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the triumphal-arch district's ability is filled in by its own worker. */
export const triumphalArch: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for triumphal-arch; its own worker fills this in. */
export const triumphalArchScoring: DistrictScoring = () => 0;
