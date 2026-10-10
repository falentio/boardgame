import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const SECRET_VAULT_ID = "secret-vault";

/** The end-game bonus for a Secret Vault still held in hand. */
const VAULT_BONUS = 3;

/**
 * The Secret Vault cannot be built. The engine folds this query for the card
 * being built, so answering `legal: false` for the Secret Vault refuses the build
 * before any gold or hand card moves. The `ctx.card` guard keeps the query inert
 * for every other card the engine folds it against.
 */
export const secretVaultBuild: BuildQuery = (ctx) =>
  ctx.card === SECRET_VAULT_ID ? { legal: false } : {};

/** The Secret Vault's rule is the query and the hand scorer below. */
export const secretVault: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/**
 * Score three extra points at end of game when the Secret Vault is still in the
 * owner's hand. The rule scores a hand card, not a city card, so this reads the
 * owner's hand from `state` and guards on its own id. The engine's scoring pass
 * walks only city districts, and the Secret Vault can never be built into a city,
 * so no call site reaches this scorer yet; see the unit report for the hand-scan
 * change `scoreGame` needs to award it.
 */
export const secretVaultScoring: DistrictScoring = (district, _city, seat, state) => {
  if (district.id !== SECRET_VAULT_ID) return 0;
  const held = state.players.find((player) => player.seat === seat)?.hand ?? [];
  return held.filter((id) => id === SECRET_VAULT_ID).length * VAULT_BONUS;
};

/** The build path is the query, not a hook; declared as the brief names it. */
export const secretVaultTriggers: readonly DistrictHook[] = ["onBuild"];
