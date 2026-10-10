import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** Stub: the secret-vault district's ability is filled in by its own worker. */
export const secretVault: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/** Stub: end-game points for secret-vault; its own worker fills this in. */
export const secretVaultScoring: DistrictScoring = () => 0;
