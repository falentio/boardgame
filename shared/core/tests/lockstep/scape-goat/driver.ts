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
  COLOURS,
  MIN_SEATS,
  activeSeats,
  antipodeOf,
  cardId,
  colourOfSeat,
  deckFor,
  legalActions,
  moveOwed,
  outcomeOf,
  project,
  resolveFrame,
  scapeGoat,
  seatsOwedNow,
  suspectOf,
  winnersOf,
  type CardId,
  type Colour,
  type Destination,
  type Location,
  type Phase,
  type PlayerCount,
  type PrepTokensRemaining,
  type ScapeGoatAction,
  type ScapeGoatSetup,
  type ScapeGoatState,
  type ScapeGoatView,
} from "../../../lockstep/games/scape-goat/index.ts";
import { EVIDENCE_CARDS, HAND_SIZE, coloursOf, type CardFace } from "../../../lockstep/games/scape-goat/cards.ts";
import { ScapeGoatError } from "../../../lockstep/games/scape-goat/error.ts";

export { ScapeGoatError };
export {
  COLOURS,
  EVIDENCE_CARDS,
  HAND_SIZE,
  MIN_SEATS,
  activeSeats,
  antipodeOf,
  cardId,
  colourOfSeat,
  coloursOf,
  deckFor,
  legalActions,
  moveOwed,
  outcomeOf,
  project,
  resolveFrame,
  scapeGoat,
  seatsOwedNow,
  suspectOf,
  winnersOf,
};
export type {
  CardFace,
  SeatId,
  CardId,
  Checkpoint,
  Colour,
  Destination,
  Location,
  Phase,
  PlayerCount,
  PrepTokensRemaining,
  ScapeGoatAction,
  ScapeGoatSetup,
  ScapeGoatState,
  ScapeGoatView,
};

export const ANN = seatId("ann");
export const BOB = seatId("bob");
export const CARA = seatId("cara");
export const DEE = seatId("dee");
export const EVE = seatId("eve");
export const FINN = seatId("finn");

export const SEATS: readonly SeatId[] = [ANN, BOB, CARA, DEE, EVE, FINN];
export const SEATS3: readonly SeatId[] = [ANN, BOB, CARA];
export const SEATS4: readonly SeatId[] = [ANN, BOB, CARA, DEE];
export const SEATS5: readonly SeatId[] = [ANN, BOB, CARA, DEE, EVE];
export const SEATS6: readonly SeatId[] = [ANN, BOB, CARA, DEE, EVE, FINN];

export const seatsFor = (count: PlayerCount): readonly SeatId[] => SEATS.slice(0, count);

export const PRIVATE: ScapeGoatSetup = { spyReveal: "private" };
export const PUBLIC: ScapeGoatSetup = { spyReveal: "public" };

export const rawGenesis = (
  count: PlayerCount,
  entropy = "scape-goat-raw-tests",
  setup: ScapeGoatSetup = PRIVATE,
): Checkpoint<ScapeGoatState> =>
  genesisCheckpoint(scapeGoat, {
    seed: genesisSeed(entropy),
    roster: makeRoster(seatsFor(count)),
    setup,
  });

export const owedNow = (state: ScapeGoatState): readonly SeatId[] =>
  scapeGoat.seatsOwed(state, frameIndex(0));

export const rawStep = (
  checkpoint: Checkpoint<ScapeGoatState>,
  inputs: readonly (readonly [SeatId, ScapeGoatAction | null])[] = [],
): Checkpoint<ScapeGoatState> => {
  const owed = owedNow(checkpoint.state);
  const provided = new Map<SeatId, ScapeGoatAction | null>(inputs);
  const buffer = new Map<SeatId, SeatInput<ScapeGoatAction>>();
  for (const seat of owed) {
    const action = provided.get(seat) ?? null;
    buffer.set(seat, action === null ? idle<ScapeGoatAction>() : act(action));
  }
  const frame: Frame<ScapeGoatAction> = buildFrame(
    checkpoint.roster,
    owed,
    checkpoint.frame,
    checkpoint.seed,
    buffer,
  );
  return advanceFrame(scapeGoat, checkpoint, frame);
};

export const stepState = (
  state: ScapeGoatState,
  inputs: readonly (readonly [SeatId, ScapeGoatAction | null])[] = [],
  count: PlayerCount = state.players.length as PlayerCount,
): ScapeGoatState =>
  rawStep(
    { state, roster: makeRoster(seatsFor(count)), frame: frameIndex(0), seed: genesisSeed("state") },
    inputs,
  ).state;

export type Policy = (state: ScapeGoatState, seat: SeatId) => ScapeGoatAction | null;
export type FramePolicy = (state: ScapeGoatState, seat: SeatId, frame: number) => ScapeGoatAction | null;

const mySeat = (view: ScapeGoatView, seat: SeatId) =>
  view.players.find((player) => player.seat === seat);

export const grindAction: Policy = (state, seat) => {
  const view = project(state, seat);
  const options = legalActions(view);
  if (options.length === 0) return null;
  const phase = view.phase;
  const me = mySeat(view, seat);
  if (phase.kind === "move") {
    if (phase.active !== seat) return null;
    const toPrepare = options.find((action) => action.t === "move" && action.to === "prepare");
    if (toPrepare !== undefined && me?.at !== "prepare") return toPrepare;
    return options.find((action) => action.t === "move") ?? null;
  }
  if (phase.kind === "action" && phase.location === "prepare") {
    const take = options.find((action) => action.t === "take-prep-token");
    if (take !== undefined) return take;
    return options.find((action) => action.t === "frame") ?? options[0] ?? null;
  }
  if (phase.kind === "frame-reveal") {
    const suspectColour = colourOfSeat(state, view.mySuspect);
    const ownColour = colourOfSeat(state, seat);
    let index = view.myHand.findIndex((card) => coloursOf(card).includes(suspectColour));
    if (index < 0) index = view.myHand.findIndex((card) => coloursOf(card).includes(ownColour));
    return { t: "reveal", index: index >= 0 ? index : 0 };
  }
  return options[options.length - 1] ?? null;
};

export const stashAction: Policy = (state, seat) => {
  const view = project(state, seat);
  const options = legalActions(view);
  if (options.length === 0) return null;
  const phase = view.phase;
  if (phase.kind === "move") {
    if (phase.active !== seat) return null;
    return (
      options.find((action) => action.t === "move" && action.to === "stash") ??
      options.find((action) => action.t === "move") ??
      null
    );
  }
  if (phase.kind === "action" && phase.location === "stash") {
    return options.find((action) => action.t === "stash") ?? options[0] ?? null;
  }
  if (phase.kind === "stash-put") return options.find((action) => action.t === "put") ?? null;
  if (phase.kind === "frame-reveal") return { t: "reveal", index: 0 };
  return options[options.length - 1] ?? null;
};

export const copsAction: Policy = (state, seat) =>
  legalActions(project(state, seat)).find((action) => action.t === "go-to-cops") ?? null;

/**
 * Grind until `cap` frames have been sealed, then run to the Cops. The cap is
 * the documented bound: at six players a two-card hand can make a pure framing
 * policy grind forever, so the fallback is what guarantees termination.
 */
export const capThenCops =
  (cap: number): FramePolicy =>
  (state, seat, frame) =>
    frame >= cap ? copsAction(state, seat) : grindAction(state, seat);

export const driveRaw = (
  checkpoint: Checkpoint<ScapeGoatState>,
  decide: FramePolicy,
  frame = Number(checkpoint.frame),
): Checkpoint<ScapeGoatState> =>
  rawStep(
    checkpoint,
    owedNow(checkpoint.state).map(
      (seat): readonly [SeatId, ScapeGoatAction | null] => [seat, decide(checkpoint.state, seat, frame)],
    ),
  );

export const playRaw = (
  start: Checkpoint<ScapeGoatState>,
  decide: FramePolicy,
  guard = 5000,
): { readonly checkpoint: Checkpoint<ScapeGoatState>; readonly steps: number } => {
  let checkpoint = start;
  let steps = 0;
  while (!scapeGoat.isTerminal(checkpoint.state) && steps < guard) {
    checkpoint = driveRaw(checkpoint, decide, steps);
    steps += 1;
  }
  return { checkpoint, steps };
};

export const stepResign = (
  state: ScapeGoatState,
  seat: SeatId,
  count: PlayerCount = state.players.length as PlayerCount,
): ScapeGoatState => {
  const owed = owedNow(state);
  const inputs = owed.map(
    (owedSeat): readonly [SeatId, SeatInput<ScapeGoatAction>] =>
      owedSeat === seat ? [owedSeat, resign<ScapeGoatAction>()] : [owedSeat, idle<ScapeGoatAction>()],
  );
  const frame = buildFrame(makeRoster(seatsFor(count)), owed, frameIndex(0), genesisSeed("resign"), new Map(inputs));
  return scapeGoat.step(state, frame, makeRandom(genesisSeed("resign")));
};

const mapState = (
  checkpoint: Checkpoint<ScapeGoatState>,
  fn: (state: ScapeGoatState) => ScapeGoatState,
): Checkpoint<ScapeGoatState> => ({ ...checkpoint, state: fn(checkpoint.state) });

export const withScapegoat = (
  checkpoint: Checkpoint<ScapeGoatState>,
  scapegoat: SeatId,
  suspect: SeatId,
): Checkpoint<ScapeGoatState> =>
  mapState(checkpoint, (state) => ({ ...state, scapegoat, scapegoatSuspect: suspect }));

export const withHand = (
  checkpoint: Checkpoint<ScapeGoatState>,
  seat: SeatId,
  hand: readonly string[],
): Checkpoint<ScapeGoatState> =>
  mapState(checkpoint, (state) => ({
    ...state,
    players: state.players.map((player) =>
      player.seat === seat ? { ...player, hand: hand.map(cardId) } : player,
    ),
  }));

export const withHands = (
  checkpoint: Checkpoint<ScapeGoatState>,
  hands: readonly (readonly [SeatId, readonly string[]])[],
): Checkpoint<ScapeGoatState> => hands.reduce((acc, [seat, hand]) => withHand(acc, seat, hand), checkpoint);

export const withPhase = (
  checkpoint: Checkpoint<ScapeGoatState>,
  phase: Phase,
): Checkpoint<ScapeGoatState> => mapState(checkpoint, (state) => ({ ...state, phase }));

export const withAt = (
  checkpoint: Checkpoint<ScapeGoatState>,
  seat: SeatId,
  at: Location,
): Checkpoint<ScapeGoatState> =>
  mapState(checkpoint, (state) => ({
    ...state,
    players: state.players.map((player) => (player.seat === seat ? { ...player, at } : player)),
  }));

export const withPrep = (
  checkpoint: Checkpoint<ScapeGoatState>,
  seat: SeatId,
  tokens: PrepTokensRemaining,
): Checkpoint<ScapeGoatState> =>
  mapState(checkpoint, (state) => ({
    ...state,
    players: state.players.map((player) =>
      player.seat === seat ? { ...player, prepTokens: tokens } : player,
    ),
  }));

export const withPrepareTokens = (
  checkpoint: Checkpoint<ScapeGoatState>,
  tokens: PrepTokensRemaining,
): Checkpoint<ScapeGoatState> => mapState(checkpoint, (state) => ({ ...state, prepareTokens: tokens }));

export const withResigned = (
  checkpoint: Checkpoint<ScapeGoatState>,
  seats: readonly SeatId[],
): Checkpoint<ScapeGoatState> => mapState(checkpoint, (state) => ({ ...state, resigned: [...seats] }));

export const knownScapegoat = (
  count: PlayerCount,
  scapegoat: SeatId,
  suspect: SeatId,
  entropy = "scape-goat-known-scapegoat",
): Checkpoint<ScapeGoatState> => withScapegoat(rawGenesis(count, entropy), scapegoat, suspect);

export const knownHand = (
  count: PlayerCount,
  seat: SeatId,
  hand: readonly string[],
  entropy = "scape-goat-known-hand",
): Checkpoint<ScapeGoatState> => withHand(rawGenesis(count, entropy), seat, hand);

export const flippedPrepare = (
  count: PlayerCount,
  actor: SeatId,
  entropy = "scape-goat-flipped-prepare",
): Checkpoint<ScapeGoatState> =>
  withAt(withPrepareTokens(rawGenesis(count, entropy), 0), actor, "prepare");

export const twoHolderSteal = (
  count: PlayerCount,
  actor: SeatId,
  holderA: SeatId,
  holderB: SeatId,
  entropy = "scape-goat-two-holder-steal",
): Checkpoint<ScapeGoatState> => {
  let checkpoint = flippedPrepare(count, actor, entropy);
  checkpoint = withHand(checkpoint, actor, ["goat-horns"]);
  checkpoint = withPrep(checkpoint, actor, 0);
  checkpoint = withPrep(checkpoint, holderA, 1);
  checkpoint = withPrep(checkpoint, holderB, 1);
  return checkpoint;
};

export const shrunkTable = (
  count: PlayerCount,
  entropy = "scape-goat-shrunk-table",
): Checkpoint<ScapeGoatState> => withResigned(rawGenesis(count, entropy), seatsFor(count).slice(0, 2));

export const atFrameReveal = (
  count: PlayerCount,
  framer: SeatId,
  hands: readonly (readonly [SeatId, readonly string[]])[],
  entropy = "scape-goat-frame-reveal",
): Checkpoint<ScapeGoatState> =>
  withPhase(withHands(rawGenesis(count, entropy), hands), { kind: "frame-reveal", active: framer });

export const cardIdsInPlay = (state: ScapeGoatState): readonly CardId[] => [
  ...state.players.flatMap((player) => [...player.hand]),
  ...state.stash,
  ...Object.values(state.faceUp),
];

export const cardsConserved = (state: ScapeGoatState, count: PlayerCount): boolean => {
  const deck = deckFor(count);
  const ids = cardIdsInPlay(state);
  return ids.length === deck.length && new Set(ids).size === deck.length;
};

export const prepTokensInPlay = (state: ScapeGoatState): number =>
  state.prepareTokens + state.players.reduce((total, player) => total + player.prepTokens, 0);

export const handSizes = (state: ScapeGoatState): readonly number[] =>
  state.players.map((player) => player.hand.length);

export const handOf = (state: ScapeGoatState, seat: SeatId): readonly CardId[] => {
  const player = state.players.find((candidate) => candidate.seat === seat);
  if (player === undefined) throw new Error(`no player ${seat}`);
  return player.hand;
};

export const activeSeat = (state: ScapeGoatState): SeatId => {
  const phase = state.phase;
  if (phase.kind === "over") throw new Error("game is over; no active seat");
  return phase.active;
};

export const atOf = (state: ScapeGoatState, seat: SeatId): Location => {
  const player = state.players.find((candidate) => candidate.seat === seat);
  if (player === undefined) throw new Error(`no player ${seat}`);
  return player.at;
};

export const colourOf = (state: ScapeGoatState, seat: SeatId): Colour => colourOfSeat(state, seat);
