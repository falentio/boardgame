import {
  expectArray,
  expectInteger,
  expectObject,
  expectString,
  field,
  seatId,
  type Codec,
  type Json,
  type SeatId,
} from "../../index.ts";
import { boardLimit, LIBERAL_LIMIT, powerFor, type PowerId } from "./board.ts";
import { SecretHitlerError } from "./error.ts";
import { countPolicies, POLICY_MIX, type Policy, type PolicyPile } from "./policies.ts";
import { playerCountOf, rolesFor, type Party, type PlayerCount, type Role } from "./roles.ts";

export interface PlayerState {
  readonly seat: SeatId;
  /** Hidden. The only place a role is stored. */
  readonly role: Role;
  /** Public. An executed seat is out of the game and its role is revealed. */
  readonly executed: boolean;
}

/** What one president learned from Investigate Loyalty. A party, never Hitler-ness. */
export interface Investigation {
  readonly president: SeatId;
  readonly target: SeatId;
  readonly party: Party;
}

/** What one president saw from Policy Peek. Private to that president. */
export interface PolicyPeek {
  readonly president: SeatId;
  readonly cards: readonly Policy[];
}

export type Outcome =
  | { readonly kind: "liberal-policies" }
  | { readonly kind: "fascist-policies" }
  | { readonly kind: "hitler-chancellor"; readonly chancellor: SeatId }
  | { readonly kind: "hitler-executed"; readonly target: SeatId }
  | { readonly kind: "abandoned" };

/**
 * The whole round is ONE flat, payload-carrying phase union. Nothing suspends: the
 * executive power runs after the legislative session has ended, and the veto is a
 * back-edge into \`chancellor-enact\` with the same \`offered\`, not a nested frame. So
 * \`seatsOwed\` and \`step\` are exhaustive switches and a new phase kind is a compile
 * error in both. \`drawn\` and \`offered\` are the secret payloads; \`publicPhaseOf\` strips
 * them.
 */
export type Phase =
  | { readonly kind: "nominate"; readonly president: SeatId }
  | { readonly kind: "vote"; readonly president: SeatId; readonly chancellor: SeatId }
  | {
      readonly kind: "president-discard";
      readonly president: SeatId;
      readonly chancellor: SeatId;
      readonly drawn: readonly Policy[];
    }
  | {
      readonly kind: "chancellor-enact";
      readonly president: SeatId;
      readonly chancellor: SeatId;
      readonly offered: readonly Policy[];
      /** Whether the chancellor may propose a veto in this session. False once the president refuses. */
      readonly veto: boolean;
    }
  | {
      readonly kind: "veto";
      readonly president: SeatId;
      readonly chancellor: SeatId;
      readonly offered: readonly Policy[];
    }
  | { readonly kind: "power"; readonly president: SeatId; readonly power: PowerId }
  | { readonly kind: "over"; readonly outcome: Outcome };

export interface SecretHitlerState {
  readonly players: readonly PlayerState[];
  /** Hidden; the LAST element is the top. */
  readonly drawPile: PolicyPile;
  /** Hidden; the reshuffle order is secret. */
  readonly discardPile: PolicyPile;
  readonly liberalPolicies: number;
  readonly fascistPolicies: number;
  /** Public; three advances force the chaos draw. */
  readonly electionTracker: 0 | 1 | 2;
  readonly president: SeatId;
  /** Public; the last elected government, which the term limits bar. Null before the first election. */
  readonly lastElectedPresident: SeatId | null;
  readonly lastElectedChancellor: SeatId | null;
  /**
   * Public-ish; set by the Special Election power to the seat whose turn resumes
   * once the special round ends. The special round's own candidate is the current
   * \`president\`, so the anchor is what must survive the round.
   */
  readonly specialElectionResume: SeatId | null;
  readonly investigations: readonly Investigation[];
  readonly peeks: readonly PolicyPeek[];
  readonly phase: Phase;
  readonly resigned: readonly SeatId[];
}

/**
 * A game needs a president, a chancellor candidate, and enough seats for a vote.
 * The rules give no floor for a table shrunk by execution or resignation, so this
 * is a house decision (design doc); below it the game folds to \`abandoned\`, never
 * to an empty owed set.
 */
export const MIN_ACTIVE_SEATS = 3;

export const playerCountOfState = (state: SecretHitlerState): PlayerCount =>
  playerCountOf(state.players.length);

export const activeSeats = (state: SecretHitlerState): readonly SeatId[] =>
  state.players
    .filter((player) => !player.executed && !state.resigned.includes(player.seat))
    .map((player) => player.seat);

export const roleOf = (state: SecretHitlerState, seat: SeatId): Role => {
  const player = state.players.find((entry) => entry.seat === seat);
  if (player === undefined) throw new SecretHitlerError(`seat ${seat} is not a player`);
  return player.role;
};

const decodeSeat = (json: Json, what: string): SeatId => seatId(expectString(json, what));

const decodeSeatOrNull = (json: Json, what: string): SeatId | null =>
  json === null ? null : decodeSeat(json, what);

const decodeBoolean = (json: Json, what: string): boolean => {
  if (typeof json === "boolean") return json;
  throw new SecretHitlerError(`${what}: expected a boolean`);
};

const decodePolicy = (json: Json, what: string): Policy => {
  const value = expectString(json, what);
  if (value === "liberal" || value === "fascist") return value;
  throw new SecretHitlerError(`${what}: unknown policy ${value}`);
};

const decodeRole = (json: Json, what: string): Role => {
  const value = expectString(json, what);
  if (value === "liberal" || value === "fascist" || value === "hitler") return value;
  throw new SecretHitlerError(`${what}: unknown role ${value}`);
};

const decodeParty = (json: Json, what: string): Party => {
  const value = expectString(json, what);
  if (value === "liberal" || value === "fascist") return value;
  throw new SecretHitlerError(`${what}: unknown party ${value}`);
};

const decodePower = (json: Json, what: string): PowerId => {
  const value = expectString(json, what);
  if (
    value === "investigate-loyalty" ||
    value === "special-election" ||
    value === "policy-peek" ||
    value === "execution"
  ) {
    return value;
  }
  throw new SecretHitlerError(`${what}: unknown power ${value}`);
};

const decodeTracker = (json: Json, what: string): 0 | 1 | 2 => {
  const value = expectInteger(json, what);
  if (value === 0 || value === 1 || value === 2) return value;
  throw new SecretHitlerError(`${what}: the election tracker is 0, 1, or 2, got ${String(value)}`);
};

const decodePolicies = (json: Json, what: string): readonly Policy[] =>
  expectArray(json, what).map((entry) => decodePolicy(entry, what));

const encodeOutcome = (outcome: Outcome): Json => {
  switch (outcome.kind) {
    case "liberal-policies":
      return { kind: "liberal-policies" };
    case "fascist-policies":
      return { kind: "fascist-policies" };
    case "hitler-chancellor":
      return { kind: "hitler-chancellor", chancellor: outcome.chancellor };
    case "hitler-executed":
      return { kind: "hitler-executed", target: outcome.target };
    case "abandoned":
      return { kind: "abandoned" };
  }
};

const decodeOutcome = (json: Json): Outcome => {
  const object = expectObject(json, "outcome");
  const kind = expectString(field(object, "kind"), "outcome kind");
  switch (kind) {
    case "liberal-policies":
      return { kind: "liberal-policies" };
    case "fascist-policies":
      return { kind: "fascist-policies" };
    case "hitler-chancellor":
      return {
        kind: "hitler-chancellor",
        chancellor: decodeSeat(field(object, "chancellor"), "outcome chancellor"),
      };
    case "hitler-executed":
      return {
        kind: "hitler-executed",
        target: decodeSeat(field(object, "target"), "outcome target"),
      };
    case "abandoned":
      return { kind: "abandoned" };
    default:
      throw new SecretHitlerError(`unknown outcome: ${kind}`);
  }
};

const encodePhase = (phase: Phase): Json => {
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
        drawn: [...phase.drawn],
      };
    case "chancellor-enact":
      return {
        kind: "chancellor-enact",
        president: phase.president,
        chancellor: phase.chancellor,
        offered: [...phase.offered],
        veto: phase.veto,
      };
    case "veto":
      return {
        kind: "veto",
        president: phase.president,
        chancellor: phase.chancellor,
        offered: [...phase.offered],
      };
    case "power":
      return { kind: "power", president: phase.president, power: phase.power };
    case "over":
      return { kind: "over", outcome: encodeOutcome(phase.outcome) };
  }
};

const decodePhase = (json: Json): Phase => {
  const object = expectObject(json, "phase");
  const kind = expectString(field(object, "kind"), "phase kind");
  switch (kind) {
    case "nominate":
      return { kind: "nominate", president: decodeSeat(field(object, "president"), "phase president") };
    case "vote":
      return {
        kind: "vote",
        president: decodeSeat(field(object, "president"), "phase president"),
        chancellor: decodeSeat(field(object, "chancellor"), "phase chancellor"),
      };
    case "president-discard":
      return {
        kind: "president-discard",
        president: decodeSeat(field(object, "president"), "phase president"),
        chancellor: decodeSeat(field(object, "chancellor"), "phase chancellor"),
        drawn: decodePolicies(field(object, "drawn"), "phase drawn"),
      };
    case "chancellor-enact":
      return {
        kind: "chancellor-enact",
        president: decodeSeat(field(object, "president"), "phase president"),
        chancellor: decodeSeat(field(object, "chancellor"), "phase chancellor"),
        offered: decodePolicies(field(object, "offered"), "phase offered"),
        veto: decodeBoolean(field(object, "veto"), "phase veto"),
      };
    case "veto":
      return {
        kind: "veto",
        president: decodeSeat(field(object, "president"), "phase president"),
        chancellor: decodeSeat(field(object, "chancellor"), "phase chancellor"),
        offered: decodePolicies(field(object, "offered"), "phase offered"),
      };
    case "power":
      return {
        kind: "power",
        president: decodeSeat(field(object, "president"), "phase president"),
        power: decodePower(field(object, "power"), "phase power"),
      };
    case "over":
      return { kind: "over", outcome: decodeOutcome(field(object, "outcome")) };
    default:
      throw new SecretHitlerError(`unknown phase: ${kind}`);
  }
};

const encodePlayer = (player: PlayerState): Json => ({
  seat: player.seat,
  role: player.role,
  executed: player.executed,
});

const decodePlayer = (json: Json): PlayerState => {
  const object = expectObject(json, "player");
  return {
    seat: decodeSeat(field(object, "seat"), "player seat"),
    role: decodeRole(field(object, "role"), "player role"),
    executed: decodeBoolean(field(object, "executed"), "player executed"),
  };
};

const encodeInvestigation = (investigation: Investigation): Json => ({
  president: investigation.president,
  target: investigation.target,
  party: investigation.party,
});

const decodeInvestigation = (json: Json): Investigation => {
  const object = expectObject(json, "investigation");
  return {
    president: decodeSeat(field(object, "president"), "investigation president"),
    target: decodeSeat(field(object, "target"), "investigation target"),
    party: decodeParty(field(object, "party"), "investigation party"),
  };
};

const encodePeek = (peek: PolicyPeek): Json => ({ president: peek.president, cards: [...peek.cards] });

const decodePeek = (json: Json): PolicyPeek => {
  const object = expectObject(json, "peek");
  return {
    president: decodeSeat(field(object, "president"), "peek president"),
    cards: decodePolicies(field(object, "cards"), "peek cards"),
  };
};

export const phasePayload = (phase: Phase): readonly Policy[] => {
  switch (phase.kind) {
    case "president-discard":
      return phase.drawn;
    case "chancellor-enact":
    case "veto":
      return phase.offered;
    default:
      return [];
  }
};

const sortedRoles = (roles: readonly Role[]): readonly string[] => [...roles].sort();

/**
 * The rules the shape checks cannot express. The seed chain is a convergence
 * check, not a validator: it proves every peer folded the same frames to the same
 * state, not that the state is legal. A peer that sends a well-typed but illegal
 * snapshot therefore chains cleanly, so the invariants live here, at the one
 * boundary untrusted state crosses.
 */
const checkInvariants = (state: SecretHitlerState): void => {
  const count = playerCountOf(state.players.length);
  const seats = new Set(state.players.map((player) => player.seat));
  if (seats.size !== state.players.length) throw new SecretHitlerError("duplicate seat in players");
  const requireSeat = (seat: SeatId, what: string): void => {
    if (!seats.has(seat)) throw new SecretHitlerError(`${what} is not a seat`);
  };
  const expected = sortedRoles(rolesFor(count));
  const actual = sortedRoles(state.players.map((player) => player.role));
  if (expected.join(",") !== actual.join(",")) {
    throw new SecretHitlerError(`the role multiset does not match ${String(count)} players`);
  }
  if (state.liberalPolicies < 0 || state.liberalPolicies > LIBERAL_LIMIT) {
    throw new SecretHitlerError(`liberal policies out of range: ${String(state.liberalPolicies)}`);
  }
  if (state.fascistPolicies < 0 || state.fascistPolicies > boardLimit(count)) {
    throw new SecretHitlerError(`fascist policies out of range: ${String(state.fascistPolicies)}`);
  }
  requireSeat(state.president, "the president");
  if (state.lastElectedPresident !== null) requireSeat(state.lastElectedPresident, "the last president");
  if (state.lastElectedChancellor !== null) {
    requireSeat(state.lastElectedChancellor, "the last chancellor");
  }
  if (state.specialElectionResume !== null) {
    requireSeat(state.specialElectionResume, "the special-election anchor");
  }
  for (const seat of state.resigned) requireSeat(seat, "a resigned seat");
  for (const investigation of state.investigations) {
    requireSeat(investigation.president, "an investigating president");
    requireSeat(investigation.target, "an investigation target");
  }
  for (const peek of state.peeks) requireSeat(peek.president, "a peeking president");
  const phase = state.phase;
  switch (phase.kind) {
    case "nominate":
      requireSeat(phase.president, "the phase president");
      break;
    case "vote":
      requireSeat(phase.president, "the phase president");
      requireSeat(phase.chancellor, "the phase chancellor");
      break;
    case "president-discard":
      requireSeat(phase.president, "the phase president");
      requireSeat(phase.chancellor, "the phase chancellor");
      if (phase.drawn.length !== 3) throw new SecretHitlerError("the president must hold three cards");
      break;
    case "chancellor-enact":
      requireSeat(phase.president, "the phase president");
      requireSeat(phase.chancellor, "the phase chancellor");
      if (phase.offered.length !== 2) throw new SecretHitlerError("the chancellor must hold two cards");
      break;
    case "veto":
      requireSeat(phase.president, "the phase president");
      requireSeat(phase.chancellor, "the phase chancellor");
      if (phase.offered.length !== 2) throw new SecretHitlerError("the veto holds two cards");
      break;
    case "power": {
      requireSeat(phase.president, "the phase president");
      const granted = powerFor(count, state.fascistPolicies);
      if (granted !== phase.power) {
        throw new SecretHitlerError(
          `the power phase names ${phase.power} but the board slot grants ${String(granted)}`,
        );
      }
      break;
    }
    case "over":
      if (phase.outcome.kind === "hitler-chancellor") {
        requireSeat(phase.outcome.chancellor, "the outcome chancellor");
      } else if (phase.outcome.kind === "hitler-executed") {
        requireSeat(phase.outcome.target, "the outcome target");
      }
      break;
    default: {
      const exhausted: never = phase;
      throw new SecretHitlerError(`unknown phase ${JSON.stringify(exhausted)}`);
    }
  }
  const payload = phasePayload(phase);
  const liberal =
    countPolicies(state.drawPile).liberal +
    countPolicies(state.discardPile).liberal +
    state.liberalPolicies +
    payload.filter((card) => card === "liberal").length;
  const fascist =
    countPolicies(state.drawPile).fascist +
    countPolicies(state.discardPile).fascist +
    state.fascistPolicies +
    payload.filter((card) => card === "fascist").length;
  if (liberal !== POLICY_MIX.liberal) {
    throw new SecretHitlerError(`liberal policies do not conserve: ${String(liberal)} of 6`);
  }
  if (fascist !== POLICY_MIX.fascist) {
    throw new SecretHitlerError(`fascist policies do not conserve: ${String(fascist)} of 11`);
  }
  const active = activeSeats(state).length;
  if (phase.kind !== "over" && active < MIN_ACTIVE_SEATS) {
    throw new SecretHitlerError("a table below the active floor must be terminal");
  }
  // A filled track ends the game, so a non-over state with a full track is a lie
  // the fold would keep playing from.
  const liberalWin = state.liberalPolicies >= LIBERAL_LIMIT;
  const fascistWin = state.fascistPolicies >= boardLimit(count);
  if ((liberalWin || fascistWin) && phase.kind !== "over") {
    throw new SecretHitlerError("a filled policy track must carry the over phase");
  }
};

export const stateCodec: Codec<SecretHitlerState> = {
  encode: (state): Json => ({
    players: state.players.map(encodePlayer),
    drawPile: [...state.drawPile],
    discardPile: [...state.discardPile],
    liberalPolicies: state.liberalPolicies,
    fascistPolicies: state.fascistPolicies,
    electionTracker: state.electionTracker,
    president: state.president,
    lastElectedPresident: state.lastElectedPresident,
    lastElectedChancellor: state.lastElectedChancellor,
    specialElectionResume: state.specialElectionResume,
    investigations: state.investigations.map(encodeInvestigation),
    peeks: state.peeks.map(encodePeek),
    phase: encodePhase(state.phase),
    resigned: [...state.resigned],
  }),
  decode: (json): SecretHitlerState => {
    const object = expectObject(json, "secret-hitler state");
    const state: SecretHitlerState = {
      players: expectArray(field(object, "players"), "players").map(decodePlayer),
      drawPile: decodePolicies(field(object, "drawPile"), "draw pile"),
      discardPile: decodePolicies(field(object, "discardPile"), "discard pile"),
      liberalPolicies: expectInteger(field(object, "liberalPolicies"), "liberal policies"),
      fascistPolicies: expectInteger(field(object, "fascistPolicies"), "fascist policies"),
      electionTracker: decodeTracker(field(object, "electionTracker"), "election tracker"),
      president: decodeSeat(field(object, "president"), "president"),
      lastElectedPresident: decodeSeatOrNull(
        field(object, "lastElectedPresident"),
        "last elected president",
      ),
      lastElectedChancellor: decodeSeatOrNull(
        field(object, "lastElectedChancellor"),
        "last elected chancellor",
      ),
      specialElectionResume: decodeSeatOrNull(
        field(object, "specialElectionResume"),
        "special-election anchor",
      ),
      investigations: expectArray(field(object, "investigations"), "investigations").map(
        decodeInvestigation,
      ),
      peeks: expectArray(field(object, "peeks"), "peeks").map(decodePeek),
      phase: decodePhase(field(object, "phase")),
      resigned: expectArray(field(object, "resigned"), "resigned").map((entry) =>
        decodeSeat(entry, "resigned seat"),
      ),
    };
    checkInvariants(state);
    return state;
  },
};

