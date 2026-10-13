import {
  act,
  advanceFrame,
  buildFrame,
  frameIndex,
  genesisCheckpoint,
  genesisSeed,
  idle,
  makeRandom,
  makeRoster,
  resign,
  seatId,
  type Checkpoint,
  type Frame,
  type SeatId,
  type SeatInput,
} from "../../../index.ts";
import {
  activeSeats,
  eligibleChancellors,
  isTerminal,
  legalActions,
  outcomeOf,
  project,
  secretHitler,
  seatsOwedNow,
  type Investigation,
  type Outcome,
  type Phase,
  type PlayerCount,
  type Policy,
  type SecretHitlerAction,
  type SecretHitlerSetup,
  type SecretHitlerState,
  type SecretHitlerView,
} from "../../../lockstep/games/secret-hitler/index.ts";
import {
  FASCIST_BOARD,
  boardFor,
  boardLimit,
  boardSlot,
  powerFor,
  vetoUnlocked,
  votePasses,
  HITLER_CHANCELLOR_FASCIST,
  LIBERAL_LIMIT,
  VETO_UNLOCK_FASCIST,
  type BoardSlot,
  type PowerId,
} from "../../../lockstep/games/secret-hitler/board.ts";
import { SecretHitlerError } from "../../../lockstep/games/secret-hitler/error.ts";
import { POLICY_MIX, countPolicies, fullDeck, peekFrom, type PolicyPile } from "../../../lockstep/games/secret-hitler/policies.ts";
import {
  FASCIST_TEAM,
  MAX_SEATS,
  MIN_SEATS,
  knownAllies,
  partyOf,
  rolesFor,
  type Party,
  type Role,
  type SeatRole,
} from "../../../lockstep/games/secret-hitler/roles.ts";
import { legalPowerTargets } from "../../../lockstep/games/secret-hitler/powers.ts";
import { phasePayload, stateCodec, MIN_ACTIVE_SEATS } from "../../../lockstep/games/secret-hitler/state.ts";
import { publicPhaseOf, teamOf, winnerOf } from "../../../lockstep/games/secret-hitler/view.ts";
import { stateDigest } from "../../../index.ts";

export { SecretHitlerError, stateCodec, stateDigest };
export {
  FASCIST_BOARD,
  FASCIST_TEAM,
  HITLER_CHANCELLOR_FASCIST,
  LIBERAL_LIMIT,
  MAX_SEATS,
  MIN_ACTIVE_SEATS,
  MIN_SEATS,
  POLICY_MIX,
  VETO_UNLOCK_FASCIST,
  activeSeats,
  boardFor,
  boardLimit,
  boardSlot,
  countPolicies,
  eligibleChancellors,
  fullDeck,
  isTerminal,
  knownAllies,
  legalActions,
  legalPowerTargets,
  outcomeOf,
  partyOf,
  peekFrom,
  phasePayload,
  powerFor,
  project,
  publicPhaseOf,
  rolesFor,
  secretHitler,
  seatsOwedNow,
  teamOf,
  vetoUnlocked,
  votePasses,
  winnerOf,
};
export type {
  BoardSlot,
  Checkpoint,
  Investigation,
  Outcome,
  Party,
  Phase,
  PlayerCount,
  Policy,
  PolicyPile,
  PowerId,
  Role,
  SeatId,
  SeatRole,
  SecretHitlerAction,
  SecretHitlerSetup,
  SecretHitlerState,
  SecretHitlerView,
};

export const ANN = seatId("ann");
export const BOB = seatId("bob");
export const CARA = seatId("cara");
export const DEE = seatId("dee");
export const EVE = seatId("eve");
export const FINN = seatId("finn");
export const GUS = seatId("gus");
export const HAL = seatId("hal");
export const IVY = seatId("ivy");
export const JO = seatId("jo");

export const ALL_SEATS: readonly SeatId[] = [ANN, BOB, CARA, DEE, EVE, FINN, GUS, HAL, IVY, JO];

export const seatsFor = (count: PlayerCount): readonly SeatId[] => ALL_SEATS.slice(0, count);

export const SETUP: SecretHitlerSetup = {};

export const rawGenesis = (
  count: PlayerCount,
  entropy = "secret-hitler-raw-tests",
): Checkpoint<SecretHitlerState> =>
  genesisCheckpoint(secretHitler, {
    seed: genesisSeed(entropy),
    roster: makeRoster(seatsFor(count)),
    setup: SETUP,
  });

export const owedNow = (state: SecretHitlerState): readonly SeatId[] =>
  secretHitler.seatsOwed(state, frameIndex(0));

export const rawStep = (
  checkpoint: Checkpoint<SecretHitlerState>,
  inputs: readonly (readonly [SeatId, SecretHitlerAction | null])[] = [],
): Checkpoint<SecretHitlerState> => {
  const owed = owedNow(checkpoint.state);
  const provided = new Map<SeatId, SecretHitlerAction | null>(inputs);
  const buffer = new Map<SeatId, SeatInput<SecretHitlerAction>>();
  for (const seat of owed) {
    const action = provided.get(seat) ?? null;
    buffer.set(seat, action === null ? idle<SecretHitlerAction>() : act(action));
  }
  const frame: Frame<SecretHitlerAction> = buildFrame(
    checkpoint.roster,
    owed,
    checkpoint.frame,
    checkpoint.seed,
    buffer,
  );
  return advanceFrame(secretHitler, checkpoint, frame);
};

export const stepState = (
  state: SecretHitlerState,
  inputs: readonly (readonly [SeatId, SecretHitlerAction | null])[] = [],
  count: PlayerCount = state.players.length as PlayerCount,
): SecretHitlerState =>
  rawStep(
    { state, roster: makeRoster(seatsFor(count)), frame: frameIndex(0), seed: genesisSeed("state") },
    inputs,
  ).state;

export type Policy2 = (state: SecretHitlerState, seat: SeatId) => SecretHitlerAction | null;
export type FramePolicy = (state: SecretHitlerState, seat: SeatId, frame: number) => SecretHitlerAction | null;

/** The role of a seat, read straight from the state. Tests only. */
export const roleOf = (state: SecretHitlerState, seat: SeatId): Role => {
  const player = state.players.find((entry) => entry.seat === seat);
  if (player === undefined) throw new Error(`no seat ${seat}`);
  return player.role;
};

export const rolesOf = (state: SecretHitlerState): readonly SeatRole[] =>
  state.players.map((player) => ({ seat: player.seat, role: player.role }));

export const fascistSeats = (state: SecretHitlerState): readonly SeatId[] =>
  state.players.filter((player) => player.role !== "liberal").map((player) => player.seat);

export const hitlerSeat = (state: SecretHitlerState): SeatId => {
  const player = state.players.find((entry) => entry.role === "hitler");
  if (player === undefined) throw new Error("no hitler");
  return player.seat;
};

export const liberalSeats = (state: SecretHitlerState): readonly SeatId[] =>
  state.players.filter((player) => player.role === "liberal").map((player) => player.seat);

/** A seat that is a Liberal, or null. */
export const someLiberal = (state: SecretHitlerState): SeatId | null =>
  state.players.find((player) => player.role === "liberal")?.seat ?? null;

export const handOf = (state: SecretHitlerState, seat: SeatId): readonly Policy[] | null => {
  const view = project(state, seat);
  return view.myDrawn ?? view.myOffered;
};

/** Drives a game with a simple policy: the first legal action, preferring yes votes. */
export const autoAction: FramePolicy = (state, seat) => {
  const options = legalActions(project(state, seat));
  if (options.length === 0) return null;
  const yes = options.find((action) => action.t === "vote" && action.ja);
  if (yes !== undefined) return yes;
  return options[0] ?? null;
};

export const driveRaw = (
  checkpoint: Checkpoint<SecretHitlerState>,
  decide: FramePolicy,
  frame = Number(checkpoint.frame),
): Checkpoint<SecretHitlerState> =>
  rawStep(
    checkpoint,
    owedNow(checkpoint.state).map(
      (seat): readonly [SeatId, SecretHitlerAction | null] => [
        seat,
        decide(checkpoint.state, seat, frame),
      ],
    ),
  );

export const playRaw = (
  start: Checkpoint<SecretHitlerState>,
  decide: FramePolicy,
  guard = 5000,
): { readonly checkpoint: Checkpoint<SecretHitlerState>; readonly steps: number } => {
  let checkpoint = start;
  let steps = 0;
  while (!isTerminal(checkpoint.state) && steps < guard) {
    checkpoint = driveRaw(checkpoint, decide, steps);
    steps += 1;
  }
  return { checkpoint, steps };
};

export const stepResign = (
  state: SecretHitlerState,
  seat: SeatId,
  count: PlayerCount = state.players.length as PlayerCount,
): SecretHitlerState => {
  const owed = owedNow(state);
  const inputs = owed.map(
    (owedSeat): readonly [SeatId, SeatInput<SecretHitlerAction>] =>
      owedSeat === seat ? [owedSeat, resign<SecretHitlerAction>()] : [owedSeat, idle<SecretHitlerAction>()],
  );
  const frame = buildFrame(
    makeRoster(seatsFor(count)),
    owed,
    frameIndex(0),
    genesisSeed("resign"),
    new Map(inputs),
  );
  return secretHitler.step(state, frame, makeRandom(genesisSeed("resign")));
};

const mapState = (
  checkpoint: Checkpoint<SecretHitlerState>,
  fn: (state: SecretHitlerState) => SecretHitlerState,
): Checkpoint<SecretHitlerState> => ({ ...checkpoint, state: fn(checkpoint.state) });

/** Force a phase, the way a test wants to set up a scenario. */
export const withPhase = (
  checkpoint: Checkpoint<SecretHitlerState>,
  phase: Phase,
): Checkpoint<SecretHitlerState> => mapState(checkpoint, (state) => ({ ...state, phase }));

export const withRoles = (
  checkpoint: Checkpoint<SecretHitlerState>,
  roles: readonly (readonly [SeatId, Role])[],
): Checkpoint<SecretHitlerState> =>
  mapState(checkpoint, (state) => ({
    ...state,
    players: state.players.map((player) => {
      const role = roles.find(([seat]) => seat === player.seat)?.[1];
      return role === undefined ? player : { ...player, role };
    }),
  }));

export const withPiles = (
  checkpoint: Checkpoint<SecretHitlerState>,
  drawPile: readonly Policy[],
  discardPile: readonly Policy[] = [],
): Checkpoint<SecretHitlerState> =>
  mapState(checkpoint, (state) => ({ ...state, drawPile, discardPile }));

/**
 * A full, conserving deck whose top cards are `top` in top-first order (top[0] is
 * drawn first), filled out to the 6/11 mix around the cards already on the tracks.
 * Keeps `policiesConserved` true for scenario tests that pin a specific draw.
 */
export const withStackedPile = (
  checkpoint: Checkpoint<SecretHitlerState>,
  top: readonly Policy[],
): Checkpoint<SecretHitlerState> =>
  mapState(checkpoint, (state) => {
    const libTop = top.filter((card) => card === "liberal").length;
    const fasTop = top.filter((card) => card === "fascist").length;
    const libRest = POLICY_MIX.liberal - state.liberalPolicies - libTop;
    const fasRest = POLICY_MIX.fascist - state.fascistPolicies - fasTop;
    if (libRest < 0 || fasRest < 0) {
      throw new Error("the stacked pile asks for more cards than the mix holds");
    }
    return {
      ...state,
      drawPile: [
        ...Array<Policy>(libRest).fill("liberal"),
        ...Array<Policy>(fasRest).fill("fascist"),
        ...[...top].reverse(),
      ],
      discardPile: [],
    };
  });

export const withTracks = (
  checkpoint: Checkpoint<SecretHitlerState>,
  liberalPolicies: number,
  fascistPolicies: number,
): Checkpoint<SecretHitlerState> =>
  mapState(checkpoint, (state) => ({ ...state, liberalPolicies, fascistPolicies }));

export const withTracker = (
  checkpoint: Checkpoint<SecretHitlerState>,
  electionTracker: 0 | 1 | 2,
): Checkpoint<SecretHitlerState> => mapState(checkpoint, (state) => ({ ...state, electionTracker }));

export const withTerms = (
  checkpoint: Checkpoint<SecretHitlerState>,
  president: SeatId | null,
  chancellor: SeatId | null,
): Checkpoint<SecretHitlerState> =>
  mapState(checkpoint, (state) => ({
    ...state,
    lastElectedPresident: president,
    lastElectedChancellor: chancellor,
  }));

export const withResigned = (
  checkpoint: Checkpoint<SecretHitlerState>,
  seats: readonly SeatId[],
): Checkpoint<SecretHitlerState> => mapState(checkpoint, (state) => ({ ...state, resigned: [...seats] }));

export const withExecuted = (
  checkpoint: Checkpoint<SecretHitlerState>,
  seats: readonly SeatId[],
): Checkpoint<SecretHitlerState> =>
  mapState(checkpoint, (state) => ({
    ...state,
    players: state.players.map((player) =>
      seats.includes(player.seat) ? { ...player, executed: true } : player,
    ),
  }));

export const withPresident = (
  checkpoint: Checkpoint<SecretHitlerState>,
  president: SeatId,
): Checkpoint<SecretHitlerState> => mapState(checkpoint, (state) => ({ ...state, president }));

export const withInvestigations = (
  checkpoint: Checkpoint<SecretHitlerState>,
  investigations: readonly Investigation[],
): Checkpoint<SecretHitlerState> =>
  mapState(checkpoint, (state) => ({ ...state, investigations: [...investigations] }));

/** Every policy tile in play, across the two piles, the tracks, and the open payload. */
export const policiesInPlay = (state: SecretHitlerState): readonly Policy[] => [
  ...state.drawPile,
  ...state.discardPile,
  ...Array<Policy>(state.liberalPolicies).fill("liberal"),
  ...Array<Policy>(state.fascistPolicies).fill("fascist"),
  ...phasePayload(state.phase),
];

export const policiesConserved = (state: SecretHitlerState): boolean => {
  const counts = countPolicies(policiesInPlay(state));
  return counts.liberal === POLICY_MIX.liberal && counts.fascist === POLICY_MIX.fascist;
};

export const currentPhase = (state: SecretHitlerState): Phase => state.phase;

export const boardOf = (count: PlayerCount): readonly BoardSlot[] => boardFor(count);

/** Drive a 5-player table to an open veto phase: five Fascist Policies on the board,
 *  a unanimous yes, then the chancellor proposes the veto. */
export const driveToVeto = (entropy: string): Checkpoint<SecretHitlerState> => {
  let checkpoint = withRoles(rawGenesis(5, entropy), [
    [ANN, "fascist"],
    [BOB, "hitler"],
    [CARA, "liberal"],
    [DEE, "liberal"],
    [EVE, "liberal"],
  ]);
  checkpoint = withTracks(checkpoint, 0, VETO_UNLOCK_FASCIST);
  checkpoint = withStackedPile(checkpoint, ["liberal", "liberal", "fascist"]);
  const president = ANN;
  const chancellor = CARA;
  checkpoint = withPresident(checkpoint, president);
  checkpoint = rawStep(checkpoint, [[president, { t: "nominate", chancellor }]]);
  checkpoint = rawStep(
    checkpoint,
    owedNow(checkpoint.state).map(
      (seat): readonly [SeatId, SecretHitlerAction] => [seat, { t: "vote", ja: true }],
    ),
  );
  checkpoint = rawStep(checkpoint, [[president, { t: "discard", index: 0 }]]);
  checkpoint = rawStep(checkpoint, [[chancellor, { t: "propose-veto" }]]);
  if (checkpoint.state.phase.kind !== "veto") throw new Error("did not reach a veto phase");
  return checkpoint;
};
