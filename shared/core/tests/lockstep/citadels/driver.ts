import {
  act,
  frameIndex,
  genesisSeed,
  idle,
  makeRandom,
  makeRoster,
  seatId,
  type Frame,
  type SeatId,
  type SeatInput,
} from "../../../index.ts";
import {
  type CharacterId,
  type CitadelsAction,
  type CitadelsSetup,
  type CitadelsState,
  type CitadelsView,
  citadels,
} from "../../../lockstep/games/citadels/index.ts";
import {
  DEFAULT_UNIQUES,
  specOfDistrict,
  type DistrictId,
} from "../../../lockstep/games/citadels/districts.ts";
import { at, fakeClock, makeTable, type Table } from "../harness.ts";

export { citadels };
export type { CitadelsAction, CitadelsView, CitadelsState, CharacterId, DistrictId };

export const ANN = seatId("ann");
export const BOB = seatId("bob");
export const CARA = seatId("cara");
export const DAN = seatId("dan");
export const EVE = seatId("eve");
export const FINN = seatId("finn");

export const SEATS3: readonly [SeatId, SeatId, SeatId] = [ANN, BOB, CARA];
export const SEATS4: readonly [SeatId, SeatId, SeatId, SeatId] = [ANN, BOB, CARA, DAN];
export const SEATS5: readonly [SeatId, SeatId, SeatId, SeatId, SeatId] = [ANN, BOB, CARA, DAN, EVE];
export const SEATS6: readonly [SeatId, SeatId, SeatId, SeatId, SeatId, SeatId] = [
  ANN,
  BOB,
  CARA,
  DAN,
  EVE,
  FINN,
];

/** A legal 8-character base cast, one per rank 1-8. */
export const BASE_CAST_IDS: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

/** A legal 9-character cast, adding the rank-9 Artist. */
export const CAST9: readonly CharacterId[] = [...BASE_CAST_IDS, "artist"];

/**
 * A legal nine-character cast built from the catalog's rank table: one distinct
 * character at every rank 1-9. citadels-catalog.md fixes the ranks but does not
 * enumerate the rulebook's six preset lists, so this stands in for a preset set.
 */
export const PRESET_CAST_IDS: readonly CharacterId[] = [
  "witch",
  "blackmailer",
  "wizard",
  "patrician",
  "cardinal",
  "alchemist",
  "navigator",
  "marshal",
  "tax-collector",
];

export const RAW_SEED = genesisSeed("citadels-raw-tests");

export const setup = (
  cast: readonly CharacterId[] = BASE_CAST_IDS,
  uniques: readonly DistrictId[] = DEFAULT_UNIQUES,
): CitadelsSetup => ({ cast, uniques });

export const tableOf = (
  seats: readonly SeatId[],
  cast: readonly CharacterId[] = BASE_CAST_IDS,
  entropy = "citadels-table",
): Table<CitadelsAction, CitadelsView> =>
  makeTable(citadels, {
    seats,
    setup: setup(cast),
    seed: genesisSeed(entropy),
    clock: fakeClock().clock,
  });

export const rawGenesis = (
  seats: readonly SeatId[],
  cast: readonly CharacterId[] = BASE_CAST_IDS,
  entropy = "citadels-raw-tests",
  uniques: readonly DistrictId[] = DEFAULT_UNIQUES,
): CitadelsState =>
  citadels.genesis(setup(cast, uniques), makeRoster(seats), makeRandom(genesisSeed(entropy)));

export const rawRandom = (entropy = "citadels-raw-tests") => makeRandom(genesisSeed(entropy));

export const rawFrame = (
  index: number,
  inputs: readonly (readonly [SeatId, SeatInput<CitadelsAction>])[],
): Frame<CitadelsAction> => ({ index: frameIndex(index), seed: RAW_SEED, inputs });

export const rawStep = (
  state: CitadelsState,
  frame: Frame<CitadelsAction>,
  entropy = "citadels-raw-tests",
): CitadelsState => citadels.step(state, frame, rawRandom(entropy));

/** Apply one frame, deciding each owed seat's input from the current state. */
export const advance = (
  state: CitadelsState,
  decide: (seat: SeatId, state: CitadelsState) => CitadelsAction | null,
  entropy = "citadels-raw-tests",
): CitadelsState => {
  const owed = citadels.seatsOwed(state, frameIndex(0));
  const inputs = owed.map((seat): readonly [SeatId, SeatInput<CitadelsAction>] => {
    const action = decide(seat, state);
    return [seat, action === null ? idle<CitadelsAction>() : act<CitadelsAction>(action)];
  });
  return rawStep(state, rawFrame(0, inputs), entropy);
};

/** Report one input per owed seat in the currently open frame. */
export const driveFrame = (
  table: Table<CitadelsAction, CitadelsView>,
  decide: (seat: SeatId, view: CitadelsView) => CitadelsAction | null,
): void => {
  const opener = at(table, ANN);
  const frame = opener.frame;
  for (const seat of opener.owed()) {
    const session = at(table, seat);
    if (session.frame !== frame) continue;
    const action = decide(seat, session.view());
    session.report(action === null ? idle<CitadelsAction>() : act<CitadelsAction>(action));
  }
};

export const driveUntil = (
  table: Table<CitadelsAction, CitadelsView>,
  decide: (seat: SeatId, view: CitadelsView) => CitadelsAction | null,
  done: (view: CitadelsView) => boolean,
  guard = 500,
): void => {
  for (let i = 0; i < guard && !done(at(table, ANN).view()); i += 1) {
    driveFrame(table, decide);
  }
};

export const playToEnd = (
  table: Table<CitadelsAction, CitadelsView>,
  decide: (seat: SeatId, view: CitadelsView) => CitadelsAction | null,
  guard = 50_000,
): void => {
  for (let i = 0; i < guard && !at(table, ANN).terminal; i += 1) {
    driveFrame(table, decide);
  }
};

/** Fold a table to terminal, returning the number of frames it took. */
export const framesToEnd = (
  table: Table<CitadelsAction, CitadelsView>,
  decide: (seat: SeatId, view: CitadelsView) => CitadelsAction | null,
  guard = 50_000,
): number => {
  let frames = 0;
  for (; frames < guard && !at(table, ANN).terminal; frames += 1) {
    driveFrame(table, decide);
  }
  return frames;
};

/** Every frame the table sealed, in index order. */
export const sealedFrames = (
  table: Table<CitadelsAction, CitadelsView>,
): readonly Frame<CitadelsAction>[] =>
  [...table.sealed.entries()].sort((a, b) => a[0] - b[0]).map(([, frame]) => frame);

/** Feed recorded frames to every seat of an independent table, in order. */
export const replayFrames = (
  table: Table<CitadelsAction, CitadelsView>,
  frames: readonly Frame<CitadelsAction>[],
): void => {
  for (const frame of frames) {
    for (const seat of table.sessions.keys()) {
      at(table, seat).receive({ kind: "frame", frame });
    }
  }
};

/** Advance one raw frame under the always-legal policy. */
export const autoStep = (state: CitadelsState): CitadelsState =>
  advance(state, (seat) => autoAction(seat, citadels.project(state, seat)));

export const owedOf = (state: CitadelsState): readonly SeatId[] =>
  citadels.seatsOwed(state, frameIndex(0));

export const seatsOwedAt = (state: CitadelsState, index = 0): readonly SeatId[] =>
  citadels.seatsOwed(state, frameIndex(index));

/**
 * Every district card in play: hands, built cities, the hidden deck, the faceup
 * discard, and any card in flight in a pending action (a draw before its keep).
 */
export const totalCards = (state: CitadelsState): number =>
  state.players.reduce((n, p) => n + p.hand.length + p.city.length, 0) +
  state.deck.length +
  state.discard.length +
  (state.pending?.cards.length ?? 0);

/** Total character cards in play: the passing draft pool, the picks, and the discards. */
export const totalCharacters = (state: CitadelsState): number => {
  const draft = state.draft;
  if (draft === null) return 0;
  return (
    draft.pool.length +
    draft.picks.length +
    draft.faceup.length +
    draft.facedown.length
  );
};

export const openPurpose = (state: CitadelsState): string | null => {
  const top = state.steps[0];
  return top !== undefined && top.kind === "window" ? top.window.purpose : null;
};

export const rawPlayer = (state: CitadelsState, seat: SeatId) => {
  const player = state.players.find((p) => p.seat === seat);
  if (player === undefined) throw new Error(`no player ${seat}`);
  return player;
};

export const rawHand = (state: CitadelsState, seat: SeatId): readonly DistrictId[] =>
  rawPlayer(state, seat).hand;

export const rawGold = (state: CitadelsState, seat: SeatId): number => rawPlayer(state, seat).gold;

export const withGold = (state: CitadelsState, seat: SeatId, gold: number): CitadelsState => ({
  ...state,
  players: state.players.map((p) => (p.seat === seat ? { ...p, gold } : p)),
});

export const withHand = (
  state: CitadelsState,
  seat: SeatId,
  hand: readonly DistrictId[],
): CitadelsState => ({
  ...state,
  players: state.players.map((p) => (p.seat === seat ? { ...p, hand } : p)),
});

/** Apply one frame from a sparse input list; omitted seats are simply absent. */
export const play = (
  state: CitadelsState,
  inputs: readonly (readonly [SeatId, CitadelsAction | null])[],
  entropy = "citadels-raw-tests",
): CitadelsState =>
  rawStep(
    state,
    rawFrame(
      0,
      inputs.map(([seat, action]): readonly [SeatId, SeatInput<CitadelsAction>] =>
        action === null ? [seat, idle<CitadelsAction>()] : [seat, act<CitadelsAction>(action)],
      ),
    ),
    entropy,
  );

/** Advance whole windows until the stack returns to a `purpose` window (or terminal). */
export const runWindows = (
  state: CitadelsState,
  decide: (seat: SeatId, state: CitadelsState) => CitadelsAction | null,
  entropy = "citadels-raw-tests",
  until = "turn",
  guard = 400,
): CitadelsState => {
  let next = advance(state, decide, entropy);
  for (let i = 1; i < guard && !citadels.isTerminal(next) && openPurpose(next) !== until; i += 1) {
    next = advance(next, decide, entropy);
  }
  return next;
};

/**
 * A deterministic, always-legal policy: take gold (or draw when the hand is
 * thin), build the cheapest affordable district, and pass every other window.
 * Every window is passed, so this exercises the phase machine, not a character.
 */
const districtCost = (id: DistrictId): number => specOfDistrict(id).cost;

export const autoAction = (seat: SeatId, view: CitadelsView): CitadelsAction | null => {
  const window = view.window;
  if (window === null) return null;
  if (window.purpose === "turn") {
    const buildable = view.myHand
      .map((id, index) => ({ id, index }))
      .filter((entry) => districtCost(entry.id) <= (view.players.find((p) => p.seat === seat)?.gold ?? 0))
      .sort((a, b) => districtCost(a.id) - districtCost(b.id))[0];
    if (buildable !== undefined && view.players.find((p) => p.seat === seat)!.city.length < 8) {
      return { t: "build", card: buildable.index };
    }
    if (view.myHand.length < 4 && view.deckCount > 0) return { t: "draw" };
    return { t: "gold" };
  }
  if (window.purpose === "keep") return { t: "keep", index: 0 };
  if (window.purpose === "draft-pick") {
    const pick = view.cast[0];
    return pick === undefined ? null : { t: "pick", character: pick };
  }
  return null;
};

