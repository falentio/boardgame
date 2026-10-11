import type { BuildQuery, DistrictHook } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const SECRET_VAULT_ID = "secret-vault";

/** The flat end-game bonus for a Secret Vault still held in hand. */
const VAULT_BONUS = 3;

/**
 * The Secret Vault cannot be built. The engine folds this query for the card
 * being built, so answering `legal: false` for the Secret Vault refuses the build
 * before any gold or hand card moves, and the card stays in hand, which is what
 * its scoring clause needs. The `ctx.card` guard keeps the query inert for every
 * other card the engine folds it against.
 */
export const secretVaultBuild: BuildQuery = (ctx) =>
  ctx.card === SECRET_VAULT_ID ? { legal: false } : {};

/** The Secret Vault's in-play clause is the build refusal above; nothing runs on build. */
export const secretVault: DistrictEffect = (ctx: DistrictCtx) => ctx.state;

/**
 * Three extra points at end of game if the Secret Vault is still in your hand.
 * The rule scores a hand card, not a city card, so this reads the owner's hand
 * from `state`; the vault can never be built, so its only legal home is a hand.
 * The engine's scoring pass folds the uniques standing in a city, and the vault
 * can never stand in one, so no call site reaches this scorer yet; see the unit
 * report for the hand-scan change `scoreGame` needs to award it in a real game.
 */
export const secretVaultScoring: DistrictScoring = (_district, _city, seat, state) => {
  const held = state.players.find((player) => player.seat === seat)?.hand ?? [];
  return held.includes(SECRET_VAULT_ID) ? VAULT_BONUS : 0;
};

/** The engine hook this district answers; the refusal itself is the BuildQuery. */
export const secretVaultTriggers: readonly DistrictHook[] = ["onBuild"];
