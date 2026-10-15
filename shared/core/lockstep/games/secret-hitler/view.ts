import type { SeatId } from "../../index.ts";
import type { SecretHitlerAction } from "./actions.ts";
import { boardFor, type BoardSlot, type PowerId } from "./board.ts";
import { SecretHitlerError } from "./error.ts";
import type { Policy } from "./policies.ts";
import { legalPowerTargets } from "./powers.ts";
import { knownAllies, type Party, type Role, type SeatRole } from "./roles.ts";
import { eligibleChancellors, isTerminal, outcomeOf, playerCountOfState, seatsOwedNow } from "./reducer.ts";
import type { Outcome, Phase, SecretHitlerState } from "./state.ts";

/** The open phase with its secret payloads stripped. */
export type PublicPhase =
  | { readonly kind: "nominate"; readonly president: SeatId }
  | { readonly kind: "vote"; readonly president: SeatId; readonly chancellor: SeatId }
  | { readonly kind: "president-discard"; readonly president: SeatId; readonly chancellor: SeatId }
  | {
      readonly kind: "chancellor-enact";
      readonly president: SeatId;
      readonly chancellor: SeatId;
      readonly veto: boolean;
    }
  | { readonly kind: "veto"; readonly president: SeatId; readonly chancellor: SeatId }
  | { readonly kind: "power"; readonly president: SeatId; readonly power: PowerId }
  | { readonly kind: "over" };

export interface PlayerView {
  readonly seat: SeatId;
  readonly executed: boolean;
  readonly resigned: boolean;
}

export interface InvestigationView {
  readonly target: SeatId;
  readonly party: Party;
}

export interface PeekView {
  readonly cards: readonly Policy[];
}

export interface OutcomeView {
  readonly outcome: Outcome;
  readonly winner: "liberal" | "fascist" | null;
  /** Every seat's role, revealed at scoring. */
  readonly allRoles: readonly SeatRole[];
}

export interface SecretHitlerView {
  readonly seat: SeatId;
  readonly phase: PublicPhase;
  readonly players: readonly PlayerView[];
  readonly myRole: Role;
  /** The seats whose roles this viewer learns at setup, or null for a Liberal. */
  readonly myAllies: readonly SeatId[] | null;
  readonly liberalPolicies: number;
  readonly fascistPolicies: number;
  readonly board: readonly BoardSlot[];
  readonly electionTracker: 0 | 1 | 2;
  readonly president: SeatId;
  readonly lastElectedPresident: SeatId | null;
  readonly lastElectedChancellor: SeatId | null;
  readonly myDrawn: readonly Policy[] | null;
  readonly myOffered: readonly Policy[] | null;
  readonly myInvestigations: readonly InvestigationView[];
  readonly myPeeks: readonly PeekView[];
  readonly drawCount: number;
  readonly discardCount: number;
  readonly eligibleChancellors: readonly SeatId[];
  readonly powerTargets: readonly SeatId[];
  readonly owedSeats: readonly SeatId[];
  readonly legalActions: readonly SecretHitlerAction[];
  readonly outcome: OutcomeView | null;
  readonly terminal: boolean;
}

/**
 * The phase redaction: it removes the secret card payloads (\`drawn\`, \`offered\`)
 * and nothing else. A real removal, not a pass-through.
 */
export const publicPhaseOf = (phase: Phase): PublicPhase => {
  switch (phase.kind) {
    case "nominate":
      return { kind: "nominate", president: phase.president };
    case "vote":
      return { kind: "vote", president: phase.president, chancellor: phase.chancellor };
    case "president-discard":
      return {
        kind: "president-discard",
        president: phase.president,
        chancellor: phase.chancellor,
      };
    case "chancellor-enact":
      return {
        kind: "chancellor-enact",
        president: phase.president,
        chancellor: phase.chancellor,
        veto: phase.veto,
      };
    case "veto":
      return { kind: "veto", president: phase.president, chancellor: phase.chancellor };
    case "power":
      return { kind: "power", president: phase.president, power: phase.power };
    case "over":
      return { kind: "over" };
  }
};

export const winnerOf = (state: SecretHitlerState): "liberal" | "fascist" | null => {
  const outcome = outcomeOf(state);
  if (outcome === null || outcome.kind === "abandoned") return null;
  if (outcome.kind === "liberal-policies" || outcome.kind === "hitler-executed") return "liberal";
  return "fascist";
};

/**
 * The seats whose roles the viewer learns at setup. Named beside the state's
 * \`teamOf\` so the fascist/Hitler knowledge matrix has one owner.
 */
export const teamOf = (state: SecretHitlerState, seat: SeatId): readonly SeatId[] | null => {
  const roles: readonly SeatRole[] = state.players.map((player) => ({
    seat: player.seat,
    role: player.role,
  }));
  const viewer = roles.find((entry) => entry.seat === seat);
  if (viewer === undefined || viewer.role === "liberal") return null;
  return knownAllies(roles, seat);
};

const outcomeView = (state: SecretHitlerState, outcome: Outcome): OutcomeView => ({
  outcome,
  winner: winnerOf(state),
  allRoles: state.players.map((player): SeatRole => ({ seat: player.seat, role: player.role })),
});

/**
 * The redaction boundary. Drops every other seat's role, the deck order, the
 * discard faces, the drawn and offered cards except to their named holder, a peek
 * and an investigation except to the president who ran it.
 */
export const project = (state: SecretHitlerState, seat: SeatId): SecretHitlerView => {
  const mine = state.players.find((player) => player.seat === seat);
  if (mine === undefined) throw new SecretHitlerError(`seat ${seat} is not a player`);
  const phase = state.phase;
  const terminal = isTerminal(state);
  const outcome = outcomeOf(state);
  const isPresident = phase.kind === "president-discard" && phase.president === seat;
  const isChancellor = phase.kind === "chancellor-enact" && phase.chancellor === seat;
  const view: SecretHitlerView = {
    seat,
    phase: publicPhaseOf(phase),
    players: state.players.map((player): PlayerView => ({
      seat: player.seat,
      executed: player.executed,
      resigned: state.resigned.includes(player.seat),
    })),
    myRole: mine.role,
    myAllies: teamOf(state, seat),
    liberalPolicies: state.liberalPolicies,
    fascistPolicies: state.fascistPolicies,
    board: boardFor(playerCountOfState(state)),
    electionTracker: state.electionTracker,
    president: state.president,
    lastElectedPresident: state.lastElectedPresident,
    lastElectedChancellor: state.lastElectedChancellor,
    myDrawn: isPresident ? [...phase.drawn] : null,
    myOffered: isChancellor ? [...phase.offered] : null,
    myInvestigations: state.investigations
      .filter((investigation) => investigation.president === seat)
      .map((investigation): InvestigationView => ({
        target: investigation.target,
        party: investigation.party,
      })),
    myPeeks: state.peeks
      .filter((peek) => peek.president === seat)
      .map((peek): PeekView => ({ cards: [...peek.cards] })),
    drawCount: state.drawPile.length,
    discardCount: state.discardPile.length,
    eligibleChancellors: eligibleChancellors(state),
    powerTargets:
      phase.kind === "power" && phase.president === seat
        ? legalPowerTargets(state, phase.power)
        : [],
    owedSeats: [...seatsOwedNow(state)],
    legalActions: [],
    outcome: terminal && outcome !== null ? outcomeView(state, outcome) : null,
    terminal,
  };
  return { ...view, legalActions: legalActions(view) };
};

const handIndices = (count: number, tag: "discard" | "enact"): readonly SecretHitlerAction[] =>
  Array.from({ length: count }, (_, index) => ({ t: tag, index }) as SecretHitlerAction);

const powerMenu = (view: SecretHitlerView, power: PowerId): readonly SecretHitlerAction[] => {
  switch (power) {
    case "policy-peek":
      return [{ t: "ack" }];
    case "investigate-loyalty":
      return view.powerTargets.map((target): SecretHitlerAction => ({ t: "investigate", target }));
    case "special-election":
      return view.powerTargets.map(
        (target): SecretHitlerAction => ({ t: "special-election", target }),
      );
    case "execution":
      return view.powerTargets.map((target): SecretHitlerAction => ({ t: "execute", target }));
    default: {
      const exhausted: never = power;
      return exhausted;
    }
  }
};

/**
 * The action menu for the viewer, derived from the redacted view alone. A UI and a
 * test policy both read this instead of encoding rules, and because it reads only
 * a view it cannot leak a secret into a menu.
 */
export const legalActions = (view: SecretHitlerView): readonly SecretHitlerAction[] => {
  const phase = view.phase;
  switch (phase.kind) {
    case "nominate":
      return view.seat === phase.president
        ? view.eligibleChancellors.map(
            (chancellor): SecretHitlerAction => ({ t: "nominate", chancellor }),
          )
        : [];
    case "vote":
      return view.owedSeats.includes(view.seat)
        ? [
            { t: "vote", ja: true },
            { t: "vote", ja: false },
          ]
        : [];
    case "president-discard":
      return view.seat === phase.president && view.myDrawn !== null
        ? handIndices(view.myDrawn.length, "discard")
        : [];
    case "chancellor-enact": {
      if (view.seat !== phase.chancellor || view.myOffered === null) return [];
      const enact = handIndices(view.myOffered.length, "enact");
      return phase.veto ? [...enact, { t: "propose-veto" }] : enact;
    }
    case "veto":
      return view.seat === phase.president
        ? [{ t: "accept-veto" }, { t: "reject-veto" }]
        : [];
    case "power":
      return view.seat === phase.president ? powerMenu(view, phase.power) : [];
    case "over":
      return [];
  }
};
