import type { Random, Roster } from "../../index.ts";
import { SecretHitlerError } from "./error.ts";
import { fullDeck } from "./policies.ts";
import { dealRoles, playerCountOf, type PlayerCount } from "./roles.ts";
import type { PlayerState, SecretHitlerState } from "./state.ts";

/** Nothing to configure: the role mix and the deck are module constants, so two peers cannot disagree by agreeing on a bad setup. */
export interface SecretHitlerSetup {
  readonly _?: never;
}

export const validateSetup = (_setup: SecretHitlerSetup, roster: Roster): PlayerCount =>
  playerCountOf(roster.order.length);

/**
 * Build the initial state. Exactly two shuffles, in a fixed order: the role deal,
 * then the policy deck. Nothing else in the game shuffles at genesis.
 */
export const genesisState = (
  _setup: SecretHitlerSetup,
  roster: Roster,
  rng: Random,
): SecretHitlerState => {
  const count = validateSetup(_setup, roster);
  const dealt = dealRoles(roster.order, count, rng);
  const drawPile = rng.shuffle(fullDeck());
  const president = roster.order[0];
  if (president === undefined) throw new SecretHitlerError("secret-hitler needs at least one seat");
  const players: readonly PlayerState[] = dealt.map((entry) => ({
    seat: entry.seat,
    role: entry.role,
    executed: false,
  }));
  return {
    players,
    drawPile,
    discardPile: [],
    liberalPolicies: 0,
    fascistPolicies: 0,
    electionTracker: 0,
    president,
    lastElectedPresident: null,
    lastElectedChancellor: null,
    specialElectionResume: null,
    investigations: [],
    peeks: [],
    phase: { kind: "nominate", president },
    resigned: [],
  };
};
