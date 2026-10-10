import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const SECRET_VAULT_ID = "secret-vault";

/** The end-game bonus the vault pays while it stays in hand. */
const VAULT_BONUS = 3;

/**
 * The Secret Vault cannot be built. The engine folds this query for the card
 * being built, so `legal: false` refuses the build before any gold changes
 * hands and the card stays in hand, which is what its scoring clause needs.
 */
export const secretVaultBuild: BuildQuery = (ctx) =>
  ctx.card === SECRET_VAULT_ID ? { legal: false } : {};

/** The vault's in-play clause is the build refusal above; nothing runs on build. */
export const secretVault: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/**
 * Three extra points at end of game if the Secret Vault is still in your hand.
 *
 * The engine's unique-scoring pass folds the districts standing in a player's
 * city, and this card can never enter one, so the pass only reaches this scorer
 * for a hand-held vault once scoring.ts also folds the unique cards in hand. The
 * unit report carries that shared-file change; the scorer itself reads the hand
 * and is ready for it.
 */
export const secretVaultScoring: DistrictScoring = (_district, _city, seat, state) => {
  const player = state.players.find((entry) => entry.seat === seat);
  return (player?.hand ?? []).includes(SECRET_VAULT_ID) ? VAULT_BONUS : 0;
};

/** The engine hook this district answers; the refusal itself is the BuildQuery. */
export const secretVaultTriggers: readonly DistrictHook[] = ["onBuild"];
