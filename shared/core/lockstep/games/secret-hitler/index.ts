import {
  gameId,
  type Frame,
  type FrameIndex,
  type GameDefinition,
  type Random,
  type Roster,
  type SeatId,
} from "../../index.ts";
import { actionCodec, type SecretHitlerAction } from "./actions.ts";
import { isTerminal, seatsOwed, step } from "./reducer.ts";
import { genesisState, type SecretHitlerSetup } from "./setup.ts";
import { stateCodec, type SecretHitlerState } from "./state.ts";
import { project, type SecretHitlerView } from "./view.ts";

export { SecretHitlerError } from "./error.ts";
export type { SecretHitlerAction } from "./actions.ts";
export { actionCodec } from "./actions.ts";
export { validateSetup, type SecretHitlerSetup } from "./setup.ts";
export { genesisState } from "./setup.ts";
export {
  activeSeats,
  eligibleChancellors,
  isTerminal,
  outcomeOf,
  playerCountOfState,
  seatsOwed,
  seatsOwedNow,
  step,
} from "./reducer.ts";
export {
  FASCIST_BOARD,
  HITLER_CHANCELLOR_FASCIST,
  LIBERAL_LIMIT,
  VETO_UNLOCK_FASCIST,
  boardFor,
  boardLimit,
  boardSlot,
  powerFor,
  vetoUnlocked,
  votePasses,
  type BoardSlot,
  type PowerId,
} from "./board.ts";
export {
  FASCIST_TEAM,
  MAX_SEATS,
  MIN_SEATS,
  dealRoles,
  isFascistTeam,
  knownAllies,
  partyOf,
  playerCountOf,
  rolesFor,
  type Party,
  type PlayerCount,
  type Role,
  type SeatRole,
} from "./roles.ts";
export {
  POLICY_MIX,
  RESHUFFLE_BELOW,
  countPolicies,
  drawFrom,
  fullDeck,
  needsReshuffle,
  peekFrom,
  type Draw,
  type Policy,
  type PolicyPile,
} from "./policies.ts";
export { investigateParty, legalPowerTargets } from "./powers.ts";
export {
  MIN_ACTIVE_SEATS,
  phasePayload,
  stateCodec,
  type Investigation,
  type Outcome,
  type Phase,
  type PlayerState,
  type PolicyPeek,
  type SecretHitlerState,
} from "./state.ts";
export {
  legalActions,
  project,
  publicPhaseOf,
  teamOf,
  winnerOf,
  type InvestigationView,
  type OutcomeView,
  type PeekView,
  type PlayerView,
  type PublicPhase,
  type SecretHitlerView,
} from "./view.ts";

/**
 * Secret Hitler: 5-10 seats, two hidden teams, a policy deck, and a round of
 * nominate, vote, legislate, and an executive power. The whole round is one flat
 * phase union, so \`seatsOwed\` and \`step\` are exhaustive switches and a new phase
 * kind is a compile error in both. The role mix and the deck are module constants,
 * not lobby config; every shuffle happens in \`genesis\` except the discard reshuffle,
 * which is the only mid-game rng consumer.
 */
export const secretHitler: GameDefinition<
  SecretHitlerState,
  SecretHitlerAction,
  SecretHitlerSetup,
  SecretHitlerView
> = {
  id: gameId("secret-hitler"),
  version: 1,
  state: stateCodec,
  action: actionCodec,

  genesis(setup: SecretHitlerSetup, roster: Roster, rng: Random): SecretHitlerState {
    return genesisState(setup, roster, rng);
  },

  seatsOwed(state: SecretHitlerState, index: FrameIndex): readonly SeatId[] {
    return seatsOwed(state, index);
  },

  step(state: SecretHitlerState, frame: Frame<SecretHitlerAction>, rng: Random): SecretHitlerState {
    return step(state, frame, rng);
  },

  project(state: SecretHitlerState, seat: SeatId): SecretHitlerView {
    return project(state, seat);
  },

  isTerminal(state: SecretHitlerState): boolean {
    return isTerminal(state);
  },
};
