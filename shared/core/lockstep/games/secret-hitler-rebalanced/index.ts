/**
 * UNOFFICIAL. The rebalanced Secret Hitler variant from the secrethitler.io web
 * adaptation [SHIO]; not a Goat, Wolf, & Cabbage rule. It is the base game at
 * every count except 6, 7, and 9, where genesis applies one delta from
 * variant.ts. See docs/design/secret-hitler-rebalanced.md.
 *
 * The fold, the redaction boundary, and the terminal test are the base game's
 * functions referenced directly, not copied: only genesis and the state codec
 * (supply plus the pre-enactment floor) differ, so the two games cannot drift.
 */
import {
  gameId,
  type GameDefinition,
} from "../../index.ts";
import { actionCodec, type SecretHitlerAction } from "../secret-hitler/actions.ts";
import { isTerminal, seatsOwed, step } from "../secret-hitler/reducer.ts";
import type { SecretHitlerSetup } from "../secret-hitler/setup.ts";
import type { SecretHitlerState } from "../secret-hitler/state.ts";
import { project, type SecretHitlerView } from "../secret-hitler/view.ts";
import { genesisState, variantStateCodec } from "./variant.ts";

export {
  REBALANCE_DELTA,
  genesisState,
  rebalanceOf,
  variantMixFor,
  variantStateCodec,
  type RebalanceDelta,
} from "./variant.ts";

export type { SecretHitlerAction } from "../secret-hitler/actions.ts";
export type { SecretHitlerSetup } from "../secret-hitler/setup.ts";
export type { SecretHitlerState } from "../secret-hitler/state.ts";
export type { SecretHitlerView } from "../secret-hitler/view.ts";

export const secretHitlerRebalanced: GameDefinition<
  SecretHitlerState,
  SecretHitlerAction,
  SecretHitlerSetup,
  SecretHitlerView
> = {
  id: gameId("secret-hitler-rebalanced"),
  version: 1,
  state: variantStateCodec,
  action: actionCodec,
  genesis: genesisState,
  seatsOwed,
  step,
  project,
  isTerminal,
};
