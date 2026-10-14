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
  charactersOfRank,
  specOfCharacter,
  type CharacterId,
  type CitadelsAction,
  type CitadelsSetup,
  type CitadelsState,
  type CitadelsView,
  type Rank,
  citadels,
} from "../../../lockstep/games/citadels/index.ts";
import {
  DEFAULT_UNIQUES,
  specOfDistrict,
  type DistrictId,
} from "../../../lockstep/games/citadels/districts.ts";
import {
  UNIQUE_EFFECTS,
  type DistrictCtx,
} from "../../../lockstep/games/citadels/districts/effects.ts";
import { at, fakeClock, makeTable, type Table } from "../harness.ts";

export { citadels };
export type { CitadelsAction, CitadelsView, CitadelsState, CharacterId, DistrictId, SeatId };

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
  state.players.reduce(
    (n, p) =>
      n + p.hand.length + p.city.length + p.city.reduce((m, d) => m + (d.cards?.length ?? 0), 0),
    0,
  ) +
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
    const me = view.players.find((p) => p.seat === seat);
    // The base rule forbids building a district already in the city, so a
    // duplicate is never a legal build. The policy skips those, else it would
    // pick the same refused card every turn and the game would never finish.
    const inCity = new Set((me?.city ?? []).map((district) => district.id));
    const buildable = view.myHand
      .map((id, index) => ({ id, index }))
      .filter((entry) => !inCity.has(entry.id) && districtCost(entry.id) <= (me?.gold ?? 0))
      .sort((a, b) => districtCost(a.id) - districtCost(b.id))[0];
    if (buildable !== undefined && (me?.city.length ?? 0) < 8) {
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


// ---------------------------------------------------------------------------
// Folded games
//
// The folded-game guard these helpers serve: a character or district ability
// that only its own unit test reaches (a hand-placed window, an effect called
// directly) can be dead in a real game and nothing notices. Everything below
// starts from `rawGenesis`, so the deal, the draft, the rank cursor, the turn
// stack, and the end-of-turn hooks are the engine's own.
// ---------------------------------------------------------------------------

/** A legal cast containing `target`: the rank-1..8 defaults, the target at its own rank. */
export const castWith = (target: CharacterId): readonly CharacterId[] => {
  const cast: CharacterId[] = [];
  for (let rank = 1 as Rank; rank <= 8; rank = (rank + 1) as Rank) {
    const at = charactersOfRank(rank);
    cast.push(at.includes(target) ? target : at[0]);
  }
  if (specOfCharacter(target).rank === 9) cast.push(target);
  return cast;
};

/** Every state the engine passed through, in order, plus the deal that opened the game. */
export interface Fold {
  readonly steps: readonly CitadelsState[];
  readonly entropy: string;
}

export const foldStart = (fold: Fold): CitadelsState => fold.steps[0] as CitadelsState;

export const foldEnd = (fold: Fold): CitadelsState => fold.steps[fold.steps.length - 1] as CitadelsState;

/** The window purpose open at each frame of the fold. */
export const foldPurposes = (fold: Fold): readonly (string | null)[] =>
  fold.steps.map(openPurpose);

export const goldDelta = (fold: Fold, seat: SeatId): number =>
  rawGold(foldEnd(fold), seat) - rawGold(foldStart(fold), seat);

export const handDelta = (fold: Fold, seat: SeatId): number =>
  rawHand(foldEnd(fold), seat).length - rawHand(foldStart(fold), seat).length;

export const cityIds = (state: CitadelsState, seat: SeatId): readonly DistrictId[] =>
  rawPlayer(state, seat).city.map((district) => district.id);

/** A seeded board: cities, hands, gold, and the crown, laid over a real deal. */
export interface Board {
  readonly cities?: Readonly<Record<string, readonly DistrictId[]>>;
  readonly hands?: Readonly<Record<string, readonly DistrictId[]>>;
  readonly gold?: Readonly<Record<string, number>>;
  readonly crown?: SeatId;
  /** Gold already charged onto the Tax Collector token; carries between rounds. */
  readonly pot?: number;
}

const seedBoard = (state: CitadelsState, board: Board): CitadelsState => ({
  ...state,
  ...(board.crown === undefined ? {} : { crown: board.crown }),
  ...(board.pot === undefined ? {} : { taxPot: board.pot }),
  players: state.players.map((player) => ({
    ...player,
    ...(board.cities?.[player.seat] === undefined
      ? {}
      : { city: board.cities[player.seat].map((id) => ({ id, gold: 0 })) }),
    ...(board.hands?.[player.seat] === undefined ? {} : { hand: [...board.hands[player.seat]] }),
    ...(board.gold?.[player.seat] === undefined ? {} : { gold: board.gold[player.seat] }),
  })),
});

/** The draft policy: take the wanted character when the pool offers it, else let the engine pick. */
const draftPolicy =
  (wanted: Readonly<Record<string, CharacterId>>) =>
  (seat: SeatId, state: CitadelsState): CitadelsAction | null => {
    const want = wanted[seat];
    const pool = state.draft?.pool ?? [];
    return want !== undefined && pool.includes(want) ? { t: "pick", character: want } : null;
  };

/**
 * Fold real drafts until each named seat drafts its character. A seat that never
 * sees its character in the passing hand gets the engine's pick, so the deal that
 * comes back is a game the engine actually dealt.
 */
export const dealFor = (
  cast: readonly CharacterId[],
  seats: readonly SeatId[],
  wanted: Readonly<Record<string, CharacterId>>,
  uniques: readonly DistrictId[] = DEFAULT_UNIQUES,
  prefix = "citadels-deal",
): CitadelsState => {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const entropy = `${prefix}-${attempt}`;
    let state = rawGenesis(seats, cast, entropy, uniques);
    for (let i = 0; i < 60 && state.draft !== null; i += 1) {
      state = advance(state, draftPolicy(wanted), entropy);
    }
    if (state.draft !== null) continue;
    const dealt = Object.entries(wanted).every(([seat, character]) =>
      state.claimed.some((claim) => claim.seat === seat && claim.character === character),
    );
    if (dealt) return state;
  }
  throw new Error(`no deal gave ${JSON.stringify(wanted)} from ${cast.join(",")}`);
};

/** Stop once `seat` has acted and the turn has moved on. */
export const afterSeatTurn =
  (seat: SeatId) =>
  (steps: readonly CitadelsState[]): boolean => {
    let acted = false;
    for (const state of steps) {
      if (state.active === seat) acted = true;
      else if (acted) return true;
    }
    return false;
  };

/** Fold frames from `state` until `stop` holds, recording every state on the way. */
export const foldFrom = (
  state: CitadelsState,
  answer: (seat: SeatId, state: CitadelsState) => CitadelsAction | null,
  stop: (steps: readonly CitadelsState[]) => boolean,
  guard = 250,
  entropy = "citadels-fold",
): Fold => {
  const steps: CitadelsState[] = [state];
  while (!stop(steps) && steps.length < guard) {
    steps.push(advance(steps[steps.length - 1] as CitadelsState, answer, entropy));
  }
  return { steps, entropy };
};

/** A whole game folded from a real deal, on a board the caller arranges. */
export const foldGame = (opts: {
  readonly cast: readonly CharacterId[];
  readonly seats: readonly SeatId[];
  readonly wanted: Readonly<Record<string, CharacterId>>;
  readonly board?: Board;
  readonly uniques?: readonly DistrictId[];
  readonly answer: (seat: SeatId, state: CitadelsState) => CitadelsAction | null;
  readonly stop: (steps: readonly CitadelsState[]) => boolean;
  readonly guard?: number;
  readonly prefix?: string;
}): Fold => {
  const dealt = dealFor(
    opts.cast,
    opts.seats,
    opts.wanted,
    opts.uniques,
    opts.prefix ?? `citadels-deal-${Object.values(opts.wanted).join("-")}`,
  );
  const seeded = seedBoard(dealt, opts.board ?? {});
  return foldFrom(seeded, opts.answer, opts.stop, opts.guard ?? 250, "citadels-fold");
};

/** One character turn folded from an armed turn stack, on a board the caller arranges. */
export const foldTurn = (opts: {
  readonly character: CharacterId;
  readonly board?: Board;
  readonly cast?: readonly CharacterId[];
  readonly seats?: readonly SeatId[];
  readonly rank?: number;
  readonly uniques?: readonly DistrictId[];
  readonly answer: (seat: SeatId, state: CitadelsState) => CitadelsAction | null;
  readonly stop?: (steps: readonly CitadelsState[]) => boolean;
  readonly guard?: number;
  readonly entropy?: string;
}): Fold => {
  const seats = opts.seats ?? SEATS3;
  const character = opts.character;
  const rank = opts.rank ?? specOfCharacter(character).rank;
  const genesis = rawGenesis(
    seats,
    opts.cast ?? BASE_CAST_IDS,
    opts.entropy ?? "citadels-turn",
    opts.uniques,
  );
  const armed: CitadelsState = {
    ...seedBoard(
      {
        ...genesis,
        phase: "turn",
        draft: null,
        claimed: [{ seat: ANN, character }],
        callRank: rank,
        active: ANN,
        steps: [{ kind: "call" }, { kind: "end-round" }],
        pending: null,
      },
      opts.board ?? {},
    ),
    taxPot: opts.board?.pot ?? 0,
    builtThisTurn: 0,
  };
  return foldFrom(
    armed,
    opts.answer,
    opts.stop ?? ((steps) => steps.length > 1 && foldEnd({ steps } as Fold).phase === "draft"),
    opts.guard ?? 120,
    opts.entropy ?? "citadels-turn",
  );
};

/**
 * Wrap every unique district effect so each call is counted, delegating to the
 * real effect. The count is the proof the engine reached that district's hook:
 * a district the engine never calls keeps a zero count.
 */
export interface SpiedEffects {
  readonly calls: readonly DistrictId[];
  readonly count: (district: DistrictId) => number;
  restore(): void;
}

export const spyEffects = (): SpiedEffects => {
  const originals = new Map<DistrictId, ReturnType<typeof UNIQUE_EFFECTS[keyof typeof UNIQUE_EFFECTS]>>();
  const calls: DistrictId[] = [];
  for (const [id, effect] of Object.entries(UNIQUE_EFFECTS)) {
    originals.set(id, effect);
    UNIQUE_EFFECTS[id] = (ctx: DistrictCtx) => {
      calls.push(id);
      return effect(ctx);
    };
  }
  return {
    calls,
    count: (district) => calls.filter((call) => call === district).length,
    restore: () => {
      for (const [id, effect] of originals) UNIQUE_EFFECTS[id] = effect;
    },
  };
};
