import type { BuildQuery, DistrictHook, DistrictId } from "../districts.ts";
import type { DistrictCtx, DistrictEffect, DistrictScoring } from "./effects.ts";

/** The catalog id of the district this file owns. */
const SECRET_VAULT_ID = "secret-vault";

/** The flat end-game bonus for a Secret Vault still held in hand. */
const VAULT_BONUS = 3;

/**
 * Uniques whose end-game points come from a card in hand rather than one placed
 * in a city. `scoring.ts` folds this list over the owner's hand, which is the
 * only place the Secret Vault can ever be, since it cannot be built.
 */
export const HAND_SCORED_UNIQUES: readonly DistrictId[] = [SECRET_VAULT_ID];

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
 * from `state`; `scoring.ts` reaches it by folding `HAND_SCORED_UNIQUES` over
 * the hand, since the vault can never stand in a city.
 */
export const secretVaultScoring: DistrictScoring = (_district, _city, seat, state) => {
  const held = state.players.find((player) => player.seat === seat)?.hand ?? [];
  return held.includes(SECRET_VAULT_ID) ? VAULT_BONUS : 0;
};

/** The engine hook this district answers; the refusal itself is the BuildQuery. */
export const secretVaultTriggers: readonly DistrictHook[] = ["onBuild"];
