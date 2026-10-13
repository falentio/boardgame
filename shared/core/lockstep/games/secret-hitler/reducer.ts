import type { Frame, FrameIndex, Random, SeatId } from "../../index.ts";
import type { SecretHitlerAction } from "./actions.ts";
import { boardLimit, HITLER_CHANCELLOR_FASCIST, LIBERAL_LIMIT, powerFor, vetoUnlocked, votePasses, type PowerId } from "./board.ts";
import { SecretHitlerError } from "./error.ts";
import { drawFrom, needsReshuffle, peekFrom, type Policy, type PolicyPile } from "./policies.ts";
import { investigateParty, legalPowerTargets } from "./powers.ts";
import { isFascistTeam, partyOf, playerCountOf, type PlayerCount } from "./roles.ts";
import {
  activeSeats,
  MIN_ACTIVE_SEATS,
  phasePayload,
  roleOf,
  type Investigation,
  type Outcome,
  type Phase,
  type PlayerState,
  type SecretHitlerState,
} from "./state.ts";

export { activeSeats };

export const playerCountOfState = (state: SecretHitlerState): PlayerCount =>
  playerCountOf(state.players.length);

const actOf = (frame: Frame<SecretHitlerAction>, seat: SeatId): SecretHitlerAction | null => {
  const input = frame.inputs.find(([s]) => s === seat)?.[1];
  return input?.kind === "act" ? input.action : null;
};

const isActive = (state: SecretHitlerState, seat: SeatId): boolean =>
  activeSeats(state).includes(seat);

const over = (state: SecretHitlerState, outcome: Outcome): SecretHitlerState => ({
  ...state,
  phase: { kind: "over", outcome },
});

const endAbandoned = (state: SecretHitlerState): SecretHitlerState =>
  over(state, { kind: "abandoned" });

/** Fold every \`resign\` in the frame so the game's presence set matches the roster's. */
const foldResigns = (state: SecretHitlerState, frame: Frame<SecretHitlerAction>): SecretHitlerState => {
  const resigned = [...state.resigned];
  for (const [seat, input] of frame.inputs) {
    if (input.kind === "resign" && !resigned.includes(seat)) resigned.push(seat);
  }
  return resigned.length === state.resigned.length ? state : { ...state, resigned };
};

/**
 * Reshuffle the remaining deck with the discard when fewer than three tiles remain.
 * A no-op when the discard is empty: shuffling the remaining pile alone cannot
 * change which cards are left, only their order, so consuming rng for it would be
 * a gratuitous divergence point. Every peer calls this at the same points.
 */
const reshuffleIfNeeded = (state: SecretHitlerState, rng: Random): SecretHitlerState => {
  if (!needsReshuffle(state.drawPile) || state.discardPile.length === 0) return state;
  return {
    ...state,
    drawPile: rng.shuffle([...state.discardPile, ...state.drawPile]),
    discardPile: [],
  };
};

const withDiscard = (state: SecretHitlerState, cards: readonly Policy[]): SecretHitlerState =>
  cards.length === 0 ? state : { ...state, discardPile: [...state.discardPile, ...cards] };

/** The next active seat strictly after \`from\`, wrapping; null when no active seat exists. */
const nextActiveAfter = (state: SecretHitlerState, from: SeatId): SeatId | null => {
  const active = activeSeats(state);
  if (active.length === 0) return null;
  const order = state.players.map((player) => player.seat);
  const position = order.indexOf(from);
  if (position < 0) return active[0] ?? null;
  return active.find((seat) => order.indexOf(seat) > position) ?? active[0] ?? null;
};

/**
 * The next president. After a Special Election round the rotation resumes from the
 * seat to the left of the President who enacted it, so a special election skips no
 * one; otherwise it advances from the sitting president.
 */
const nextPresident = (state: SecretHitlerState): SeatId | null => {
  const anchor = state.specialElectionResume ?? state.president;
  return nextActiveAfter(state, anchor);
};

const beginNomination = (state: SecretHitlerState, president: SeatId): SecretHitlerState => ({
  ...state,
  president,
  phase: { kind: "nominate", president },
});

/** End the round: advance the presidency, clear the special-election anchor, open a nomination. */
const beginNextRound = (state: SecretHitlerState): SecretHitlerState => {
  if (activeSeats(state).length < MIN_ACTIVE_SEATS) return endAbandoned(state);
  const president = nextPresident(state);
  if (president === null) return endAbandoned(state);
  return beginNomination({ ...state, specialElectionResume: null }, president);
};

const drawThree = (state: SecretHitlerState, rng: Random): readonly [readonly Policy[], SecretHitlerState] => {
  const ready = reshuffleIfNeeded(state, rng);
  const { drawn, rest } = drawFrom(ready.drawPile, 3);
  return [drawn, { ...ready, drawPile: rest }];
};

/** Force a reshuffle of the deck with the discard, regardless of the threshold. */
const reshuffleAll = (state: SecretHitlerState, rng: Random): SecretHitlerState => ({
  ...state,
  drawPile: rng.shuffle([...state.discardPile, ...state.drawPile]),
  discardPile: [],
});

/**
 * The chaos draw: reveal the top policy from the current deck, then reshuffle if
 * fewer than three remain, and enact the revealed policy with no power [RB p4].
 * The reveal happens before the reshuffle, so a deck of exactly three reveals its
 * own top card rather than a reshuffled one (research gap 2). The forced reshuffle
 * only fires when the deck is empty, which the end-of-session reshuffle prevents.
 */
const chaos = (state: SecretHitlerState, rng: Random): SecretHitlerState => {
  const ready = state.drawPile.length === 0 ? reshuffleAll(state, rng) : state;
  const { drawn, rest } = drawFrom(ready.drawPile, 1);
  const policy = drawn[0];
  if (policy === undefined) throw new SecretHitlerError("the chaos draw found no policy");
  // The chaos enactment forgets the existing term limits [RB p4].
  const revealed: SecretHitlerState = {
    ...ready,
    drawPile: rest,
    lastElectedPresident: null,
    lastElectedChancellor: null,
  };
  const next = enactPolicy(revealed, policy, "chaos");
  return isTerminal(next) ? next : reshuffleIfNeeded(next, rng);
};

/**
 * A policy is enacted face up; the tracker resets and a win may fire. No reshuffle
 * here: the reshuffle happens immediately before each draw, so a session always
 * finds three tiles to draw [RB p4, p5; research gap 2 and 8].
 */
const enactPolicy = (
  state: SecretHitlerState,
  policy: Policy,
  grantedBy: "legislature" | "chaos",
): SecretHitlerState => {
  const count = playerCountOfState(state);
  const liberalPolicies = state.liberalPolicies + (policy === "liberal" ? 1 : 0);
  const fascistPolicies = state.fascistPolicies + (policy === "fascist" ? 1 : 0);
  const enacted: SecretHitlerState = {
    ...state,
    liberalPolicies,
    fascistPolicies,
    electionTracker: 0,
  };
  if (liberalPolicies >= LIBERAL_LIMIT) return over(enacted, { kind: "liberal-policies" });
  if (fascistPolicies >= boardLimit(count)) return over(enacted, { kind: "fascist-policies" });
  if (grantedBy === "legislature" && policy === "fascist") {
    const power = powerFor(count, fascistPolicies);
    if (power !== null) {
      return { ...enacted, phase: { kind: "power", president: enacted.president, power } };
    }
  }
  return beginNextRound(enacted);
};

const failedElection = (state: SecretHitlerState, rng: Random): SecretHitlerState => {
  const tracker = state.electionTracker + 1;
  if (tracker >= 3) return chaos(state, rng);
  return beginNextRound({ ...state, electionTracker: tracker as 0 | 1 | 2 });
};

const eligibleChancellor = (state: SecretHitlerState, seat: SeatId): boolean => {
  if (!isActive(state, seat)) return false;
  if (seat === state.president) return false;
  if (seat === state.lastElectedChancellor) return false;
  // Only at five players may the last elected President be renominated [RB p3].
  if (activeSeats(state).length > 5 && seat === state.lastElectedPresident) return false;
  return true;
};

export const eligibleChancellors = (state: SecretHitlerState): readonly SeatId[] =>
  activeSeats(state).filter((seat) => eligibleChancellor(state, seat));

const stepNominate = (
  state: SecretHitlerState,
  phase: Extract<Phase, { kind: "nominate" }>,
  frame: Frame<SecretHitlerAction>,
  rng: Random,
): SecretHitlerState => {
  if (!isActive(state, phase.president)) return beginNextRound(state);
  const input = actOf(frame, phase.president);
  const requested = input?.t === "nominate" ? input.chancellor : null;
  const eligible = eligibleChancellors(state);
  const pick =
    requested !== null && eligible.includes(requested) ? requested : (eligible[0] ?? null);
  // No eligible nominee is a government that cannot form: count it as a rejected
  // government so the tracker advances and the chaos reset eventually unblocks it.
  if (pick === null) return failedElection(state, rng);
  return { ...state, phase: { kind: "vote", president: phase.president, chancellor: pick } };
};

const stepVote = (
  state: SecretHitlerState,
  phase: Extract<Phase, { kind: "vote" }>,
  frame: Frame<SecretHitlerAction>,
  rng: Random,
): SecretHitlerState => {
  const voters = activeSeats(state);
  const yes = voters.filter((seat) => {
    const input = actOf(frame, seat);
    return input?.t === "vote" && input.ja;
  }).length;
  if (!votePasses(yes, voters.length)) return failedElection(state, rng);
  const seated: SecretHitlerState = {
    ...state,
    lastElectedPresident: phase.president,
    lastElectedChancellor: phase.chancellor,
  };
  if (
    state.fascistPolicies >= HITLER_CHANCELLOR_FASCIST &&
    roleOf(state, phase.chancellor) === "hitler"
  ) {
    return over(seated, { kind: "hitler-chancellor", chancellor: phase.chancellor });
  }
  const [drawn, ready] = drawThree(seated, rng);
  return {
    ...ready,
    phase: {
      kind: "president-discard",
      president: phase.president,
      chancellor: phase.chancellor,
      drawn,
    },
  };
};

const stepPresidentDiscard = (
  state: SecretHitlerState,
  phase: Extract<Phase, { kind: "president-discard" }>,
  frame: Frame<SecretHitlerAction>,
): SecretHitlerState => {
  if (!isActive(state, phase.president)) {
    const next = beginNextRound(withDiscard(state, phase.drawn));
    return next;
  }
  const input = actOf(frame, phase.president);
  const requested = input?.t === "discard" ? input.index : 0;
  const index = Number.isInteger(requested) && requested >= 0 && requested < 3 ? requested : 0;
  const discarded = phase.drawn[index];
  const offered = phase.drawn.filter((_, at) => at !== index);
  if (discarded === undefined || offered.length !== 2) {
    throw new SecretHitlerError("the president must hold exactly three cards to discard one");
  }
  return {
    ...withDiscard(state, [discarded]),
    phase: {
      kind: "chancellor-enact",
      president: phase.president,
      chancellor: phase.chancellor,
      offered,
      veto: vetoUnlocked(state.fascistPolicies),
    },
  };
};

const stepChancellorEnact = (
  state: SecretHitlerState,
  phase: Extract<Phase, { kind: "chancellor-enact" }>,
  frame: Frame<SecretHitlerAction>,
  rng: Random,
): SecretHitlerState => {
  if (!isActive(state, phase.chancellor)) {
    const next = beginNextRound(withDiscard(state, phase.offered));
    return isTerminal(next) ? next : reshuffleIfNeeded(next, rng);
  }
  const input = actOf(frame, phase.chancellor);
  if (input?.t === "propose-veto" && phase.veto) {
    return {
      ...state,
      phase: {
        kind: "veto",
        president: phase.president,
        chancellor: phase.chancellor,
        offered: phase.offered,
      },
    };
  }
  const requested = input?.t === "enact" ? input.index : 0;
  const index = Number.isInteger(requested) && requested >= 0 && requested < 2 ? requested : 0;
  const enacted = phase.offered[index];
  const dropped = phase.offered.filter((_, at) => at !== index);
  if (enacted === undefined || dropped.length !== 1) {
    throw new SecretHitlerError("the chancellor must hold exactly two cards to enact one");
  }
  const next = enactPolicy(withDiscard(state, dropped), enacted, "legislature");
  // At the end of a Legislative Session, reshuffle if fewer than three remain [RB p4].
  return isTerminal(next) ? next : reshuffleIfNeeded(next, rng);
};

const stepVeto = (
  state: SecretHitlerState,
  phase: Extract<Phase, { kind: "veto" }>,
  frame: Frame<SecretHitlerAction>,
  rng: Random,
): SecretHitlerState => {
  const input = actOf(frame, phase.president);
  if (input?.t === "accept-veto") {
    // A used veto discards all three tiles and advances the tracker by one [RB p6].
    const discarded = withDiscard(state, phase.offered);
    const tracker = state.electionTracker + 1;
    if (tracker >= 3) return chaos(discarded, rng);
    const next = beginNextRound({ ...discarded, electionTracker: tracker as 0 | 1 | 2 });
    return isTerminal(next) ? next : reshuffleIfNeeded(next, rng);
  }
  return {
    ...state,
    phase: {
      kind: "chancellor-enact",
      president: phase.president,
      chancellor: phase.chancellor,
      offered: phase.offered,
      veto: false,
    },
  };
};

const stepPower = (
  state: SecretHitlerState,
  phase: Extract<Phase, { kind: "power" }>,
  frame: Frame<SecretHitlerAction>,
  rng: Random,
): SecretHitlerState => {
  if (!isActive(state, phase.president)) return beginNextRound(state);
  const input = actOf(frame, phase.president);
  switch (phase.power) {
    case "policy-peek": {
      const peek = { president: phase.president, cards: peekFrom(state.drawPile, 3) };
      return beginNextRound({ ...state, peeks: [...state.peeks, peek] });
    }
    case "investigate-loyalty": {
      const targets = legalPowerTargets(state, "investigate-loyalty");
      const requested = input?.t === "investigate" ? input.target : null;
      const target = requested !== null && targets.includes(requested) ? requested : (targets[0] ?? null);
      if (target === null) return beginNextRound(state);
      const investigation: Investigation = {
        president: phase.president,
        target,
        party: investigateParty(state, target),
      };
      return beginNextRound({ ...state, investigations: [...state.investigations, investigation] });
    }
    case "special-election": {
      const targets = legalPowerTargets(state, "special-election");
      const requested = input?.t === "special-election" ? input.target : null;
      const target = requested !== null && targets.includes(requested) ? requested : (targets[0] ?? null);
      if (target === null) return beginNextRound(state);
      // The anchor is the enactor: the rotation resumes from their left afterwards.
      return beginNomination(
        { ...state, specialElectionResume: phase.president, electionTracker: state.electionTracker },
        target,
      );
    }
    case "execution": {
      const targets = legalPowerTargets(state, "execution");
      const requested = input?.t === "execute" ? input.target : null;
      const target = requested !== null && targets.includes(requested) ? requested : (targets[0] ?? null);
      if (target === null) return beginNextRound(state);
      const executed: SecretHitlerState = {
        ...state,
        players: state.players.map((player): PlayerState =>
          player.seat === target ? { ...player, executed: true } : player,
        ),
      };
      if (roleOf(state, target) === "hitler") return over(executed, { kind: "hitler-executed", target });
      return beginNextRound(executed);
    }
    default: {
      const exhausted: never = phase.power;
      return exhausted;
    }
  }
};

const runPhase = (
  state: SecretHitlerState,
  frame: Frame<SecretHitlerAction>,
  rng: Random,
): SecretHitlerState => {
  switch (state.phase.kind) {
    case "nominate":
      return stepNominate(state, state.phase, frame, rng);
    case "vote":
      return stepVote(state, state.phase, frame, rng);
    case "president-discard":
      return stepPresidentDiscard(state, state.phase, frame);
    case "chancellor-enact":
      return stepChancellorEnact(state, state.phase, frame, rng);
    case "veto":
      return stepVeto(state, state.phase, frame, rng);
    case "power":
      return stepPower(state, state.phase, frame, rng);
    case "over":
      return state;
    default: {
      const exhausted: never = state.phase;
      return exhausted;
    }
  }
};

/**
 * The pure fold. Total over every input: an illegal or hostile report coerces to a
 * safe default, a resigning actor hands the turn on, and a table below the active
 * floor abandons. \`rng\` is consumed only by a reshuffle, and only from \`frame.seed\`.
 */
export const step = (
  state: SecretHitlerState,
  frame: Frame<SecretHitlerAction>,
  rng: Random,
): SecretHitlerState => {
  if (isTerminal(state)) return state;
  const folded = foldResigns(state, frame);
  if (activeSeats(folded).length < MIN_ACTIVE_SEATS) {
    return endAbandoned(withDiscard(folded, phasePayload(folded.phase)));
  }
  return runPhase(folded, frame, rng);
};

const phaseOwed = (state: SecretHitlerState): readonly SeatId[] => {
  if (isTerminal(state)) return [];
  switch (state.phase.kind) {
    case "nominate":
      return [state.phase.president];
    case "vote":
      return activeSeats(state);
    case "president-discard":
      return [state.phase.president];
    case "chancellor-enact":
      return [state.phase.chancellor];
    case "veto":
      return [state.phase.president];
    case "power":
      return [state.phase.president];
    case "over":
      return [];
    default: {
      const exhausted: never = state.phase;
      return exhausted;
    }
  }
};

/**
 * The seats owed in the open phase, in canonical order. The final guard keeps the
 * contract total: a non-terminal state must never owe nothing, or the session would
 * seal empty frames forever.
 */
export const seatsOwedNow = (state: SecretHitlerState): readonly SeatId[] => {
  const owed = phaseOwed(state).filter((seat) => isActive(state, seat));
  if (owed.length > 0 || isTerminal(state)) return owed;
  return activeSeats(state);
};

export const seatsOwed = (state: SecretHitlerState, _index: FrameIndex): readonly SeatId[] =>
  seatsOwedNow(state);

/** Terminal once the game is over or the table has shrunk below the active floor. */
export const isTerminal = (state: SecretHitlerState): boolean =>
  state.phase.kind === "over" || activeSeats(state).length < MIN_ACTIVE_SEATS;

/** The outcome of a finished game, or null while it runs. Derived so a shrunk table reads abandoned. */
export const outcomeOf = (state: SecretHitlerState): Outcome | null => {
  if (state.phase.kind === "over") return state.phase.outcome;
  if (activeSeats(state).length < MIN_ACTIVE_SEATS) return { kind: "abandoned" };
  return null;
};

export { partyOf, isFascistTeam, type PowerId, type PolicyPile };
