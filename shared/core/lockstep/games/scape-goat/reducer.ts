import type { Frame, FrameIndex, Random, SeatId } from "../../index.ts";
import type { ScapeGoatAction } from "./actions.ts";
import { coloursOf, type CardId } from "./cards.ts";
import { ScapeGoatError } from "./error.ts";
import { faceOf, LOCATION_LINE } from "./locations.ts";
import {
  COLOURS,
  MIN_SEATS,
  type Colour,
  type Destination,
  type FrameRecord,
  type FrameReveal,
  type Outcome,
  type Phase,
  type PlayerState,
  type PrepTokensRemaining,
  type ScapeGoatState,
  type StashSlot,
} from "./state.ts";

export const findPlayer = (state: ScapeGoatState, seat: SeatId): PlayerState | undefined =>
  state.players.find((player) => player.seat === seat);

export const activeSeats = (state: ScapeGoatState): readonly SeatId[] =>
  state.players.filter((player) => !state.resigned.includes(player.seat)).map((p) => p.seat);

/**
 * The colour printed on a seat's mat. The seat's index in `players` is its index in
 * `Roster.order`, because `genesisState` builds `players` in roster order and nothing
 * ever reorders it. Only the mat's reverse is secret.
 */
export const colourOfSeat = (state: ScapeGoatState, seat: SeatId): Colour => {
  const position = state.players.findIndex((player) => player.seat === seat);
  if (position < 0) throw new ScapeGoatError(`seat ${seat} is not a player`);
  return COLOURS[position] ?? COLOURS[0]!;
};

/**
 * The seat that may pre-empt the active seat's turn at six players: three seats
 * along the circle. Only defined at six, where `+3` and `-3` name the same seat,
 * so the rulebook's direction ambiguity disappears.
 */
export const antipodeOf = (state: ScapeGoatState, seat: SeatId): SeatId | null => {
  if (state.players.length !== 6) return null;
  const order = state.players.map((player) => player.seat);
  const position = order.indexOf(seat);
  if (position < 0) return null;
  return order[(position + 3) % order.length] ?? null;
};

const phaseActive = (phase: Phase): SeatId | null => (phase.kind === "over" ? null : phase.active);

const withPlayer = (state: ScapeGoatState, next: PlayerState): ScapeGoatState => ({
  ...state,
  players: state.players.map((player) => (player.seat === next.seat ? next : player)),
});

const actOf = (frame: Frame<ScapeGoatAction>, seat: SeatId): ScapeGoatAction | null => {
  const input = frame.inputs.find(([s]) => s === seat)?.[1];
  return input?.kind === "act" ? input.action : null;
};

/** Fold every `resign` in the frame, so the game's presence set matches the roster's. */
const foldResigns = (state: ScapeGoatState, frame: Frame<ScapeGoatAction>): ScapeGoatState => {
  const resigned = [...state.resigned];
  for (const [seat, input] of frame.inputs) {
    if (input.kind === "resign" && !resigned.includes(seat)) resigned.push(seat);
  }
  return resigned.length === state.resigned.length ? state : { ...state, resigned };
};

const endCops = (state: ScapeGoatState, actor: SeatId): ScapeGoatState => ({
  ...state,
  phase: { kind: "over", outcome: { kind: "cops", actor } },
});

const endAbandoned = (state: ScapeGoatState): ScapeGoatState => ({
  ...state,
  phase: { kind: "over", outcome: { kind: "abandoned" } },
});

const endFrame = (state: ScapeGoatState, actor: SeatId, framed: SeatId): ScapeGoatState => ({
  ...state,
  phase: { kind: "over", outcome: { kind: "frame", actor, framed } },
});

const nextActiveSeat = (state: ScapeGoatState, from: SeatId): SeatId | null => {
  const seats = activeSeats(state);
  if (seats.length === 0) return null;
  const order = state.players.map((player) => player.seat);
  const position = order.indexOf(from);
  return seats.find((seat) => order.indexOf(seat) > position) ?? seats[0] ?? null;
};

/**
 * End the current turn. Both per-turn records go: the Spy hand belongs to the
 * spy's own turn, and a frame attempt's reveal is public only for the rest of
 * the turn that resolved it. Clearing the record here is what keeps a card that
 * was revealed and then placed facedown in the Stash out of every view, since the
 * Stash identities must never cross the boundary. A record set by a successful
 * frame survives, because the game is over and no card moves again.
 */
const handTurn = (state: ScapeGoatState): ScapeGoatState => {
  const active = phaseActive(state.phase);
  const next = active === null ? null : nextActiveSeat(state, active);
  if (next === null) return endAbandoned(state);
  return { ...state, spy: null, frame: null, phase: { kind: "move", active: next } };
};

/**
 * The only phase with a debt. A Stash draw puts a card in the drawer's hand, so
 * the drawer owes the row a card back and must return it even when resigning, or
 * the hand size and the Stash supply both break for the rest of the game. A
 * swap is one card out and one card in, so a resigning seat can leave it
 * undone without losing a card.
 */
const DEBT_PHASES: ReadonlySet<Phase["kind"]> = new Set(["stash-put"]);

const beginSwap = (state: ScapeGoatState, active: SeatId): ScapeGoatState => ({
  ...state,
  phase: { kind: "swap", active },
});

const transferToken = (state: ScapeGoatState, from: SeatId, to: SeatId): ScapeGoatState => {
  const holder = findPlayer(state, from);
  const taker = findPlayer(state, to);
  if (holder === undefined || taker === undefined || holder.prepTokens === 0) return state;
  return withPlayer(
    withPlayer(state, { ...holder, prepTokens: (holder.prepTokens - 1) as PrepTokensRemaining }),
    { ...taker, prepTokens: Math.min(2, taker.prepTokens + 1) as PrepTokensRemaining },
  );
};

const pickOtherSeat = (
  state: ScapeGoatState,
  self: SeatId,
  requested: SeatId | null,
): SeatId | null => {
  const others = activeSeats(state).filter((seat) => seat !== self);
  if (requested !== null && others.includes(requested)) return requested;
  return others[0] ?? null;
};

const stealTarget = (
  state: ScapeGoatState,
  self: SeatId,
  requested: SeatId | null,
): SeatId | null => {
  const holders = activeSeats(state).filter(
    (seat) => seat !== self && (findPlayer(state, seat)?.prepTokens ?? 0) > 0,
  );
  if (requested !== null && holders.includes(requested)) return requested;
  return holders[0] ?? null;
};

/**
 * The hand index an input names, or null when the input is not that action or
 * the index is out of range. `frame-reveal` reads this strictly: a seat that did
 * not pick must fail the attempt rather than fall through to a default card.
 */
const pickIndex = (input: ScapeGoatAction | null, hand: readonly CardId[]): number | null => {
  if (input === null || input.t !== "reveal") return null;
  if (!Number.isInteger(input.index) || input.index < 0 || input.index >= hand.length) return null;
  return input.index;
};

const placedIndex = (
  input: ScapeGoatAction | null,
  hand: readonly CardId[],
  tag: "give" | "put" | "swap",
): number | null => {
  if (hand.length === 0) return null;
  if (input !== null && input.t === tag && Number.isInteger(input.index)) {
    if (input.index >= 0 && input.index < hand.length) return input.index;
  }
  return 0;
};

/**
 * The index the Evidence Swap places. A held own-colour card is mandatory, so an
 * illegal report coerces to one of those when any exists; the card that leaves
 * becomes public, which is why the obligation is the game's main information
 * channel.
 */
const swapIndex = (
  state: ScapeGoatState,
  player: PlayerState,
  input: ScapeGoatAction | null,
): number | null => {
  if (player.hand.length === 0) return null;
  const own = colourOfSeat(state, player.seat);
  const forced = player.hand
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => coloursOf(card).includes(own))
    .map(({ index }) => index);
  const requested = input !== null && input.t === "swap" ? input.index : null;
  if (
    requested !== null &&
    Number.isInteger(requested) &&
    requested >= 0 &&
    requested < player.hand.length &&
    (forced.length === 0 || forced.includes(requested))
  ) {
    return requested;
  }
  return forced[0] ?? 0;
};

const legalMove = (player: PlayerState, input: ScapeGoatAction | null): Destination | "cops" => {
  if (input !== null && input.t === "move") {
    if (input.to === "cops") return "cops";
    if (input.to !== player.at) return input.to;
  }
  return LOCATION_LINE.find((destination) => destination !== player.at) ?? "prepare";
};

export const moveOwed = (state: ScapeGoatState, active: SeatId): readonly SeatId[] => {
  const antipode = antipodeOf(state, active);
  return antipode === null ? [active] : [active, antipode];
};

const copsRunInFrame = (
  state: ScapeGoatState,
  owed: readonly SeatId[],
  frame: Frame<ScapeGoatAction>,
): SeatId | null => {
  for (const [seat, input] of frame.inputs) {
    if (!owed.includes(seat) || state.resigned.includes(seat)) continue;
    if (input.kind === "act" && input.action.t === "go-to-cops") return seat;
  }
  return null;
};

const stepMove = (
  state: ScapeGoatState,
  phase: Extract<Phase, { kind: "move" }>,
  frame: Frame<ScapeGoatAction>,
): ScapeGoatState => {
  const player = findPlayer(state, phase.active);
  if (player === undefined) return handTurn(state);
  const to = legalMove(player, actOf(frame, player.seat));
  if (to === "cops") return endCops(state, phase.active);
  return {
    ...withPlayer(state, { ...player, at: to }),
    phase: { kind: "action", active: phase.active, location: to },
  };
};

const stashSlot = (state: ScapeGoatState, input: ScapeGoatAction | null): StashSlot => {
  if (input !== null && input.t === "stash" && state.stash[input.slot] !== undefined) {
    return input.slot;
  }
  return 0;
};

const stepAction = (
  state: ScapeGoatState,
  phase: Extract<Phase, { kind: "action" }>,
  frame: Frame<ScapeGoatAction>,
): ScapeGoatState => {
  const player = findPlayer(state, phase.active);
  if (player === undefined) return handTurn(state);
  const input = actOf(frame, player.seat);
  switch (faceOf(phase.location, state.prepareTokens)) {
    case "prepare": {
      const taken = withPlayer(
        { ...state, prepareTokens: (state.prepareTokens - 1) as PrepTokensRemaining },
        { ...player, prepTokens: Math.min(2, player.prepTokens + 1) as PrepTokensRemaining },
      );
      return beginSwap(taken, phase.active);
    }
    case "spy": {
      const target = pickOtherSeat(state, player.seat, input?.t === "spy" ? input.target : null);
      if (target === null) return beginSwap(state, phase.active);
      const shown = findPlayer(state, target)?.hand ?? [];
      return beginSwap(
        { ...state, spy: { spy: player.seat, target, reveal: state.spyReveal, hand: [...shown] } },
        phase.active,
      );
    }
    case "trade": {
      const target = pickOtherSeat(state, player.seat, input?.t === "trade" ? input.target : null);
      if (target === null) return beginSwap(state, phase.active);
      return { ...state, phase: { kind: "trade-give", active: player.seat, target } };
    }
    case "stash": {
      const slot = stashSlot(state, input);
      const card = state.stash[slot];
      if (card === undefined) return beginSwap(state, phase.active);
      const stash = state.stash.filter((_, index) => index !== slot);
      const next = withPlayer({ ...state, stash }, { ...player, hand: [...player.hand, card] });
      return { ...next, phase: { kind: "stash-put", active: player.seat } };
    }
    case "frame-steal": {
      if (player.prepTokens > 0) {
        return { ...state, frame: null, phase: { kind: "frame-reveal", active: player.seat } };
      }
      const holder = stealTarget(state, player.seat, input?.t === "steal" ? input.target : null);
      if (holder === null) return beginSwap(state, phase.active);
      return beginSwap(transferToken(state, holder, player.seat), phase.active);
    }
    case "cops":
      return beginSwap(state, phase.active);
  }
};

const stepTrade = (
  state: ScapeGoatState,
  phase: Extract<Phase, { kind: "trade-give" }>,
  frame: Frame<ScapeGoatAction>,
): ScapeGoatState => {
  const giver = findPlayer(state, phase.active);
  const partner = findPlayer(state, phase.target);
  if (giver === undefined) return handTurn(state);
  if (partner === undefined || state.resigned.includes(phase.target)) {
    return beginSwap(state, phase.active);
  }
  const giverIndex = placedIndex(actOf(frame, giver.seat), giver.hand, "give");
  const partnerIndex = placedIndex(actOf(frame, partner.seat), partner.hand, "give");
  const given = giverIndex === null ? undefined : giver.hand[giverIndex];
  const returned = partnerIndex === null ? undefined : partner.hand[partnerIndex];
  if (given === undefined || returned === undefined) return beginSwap(state, phase.active);
  const next = withPlayer(
    withPlayer(state, {
      ...giver,
      hand: [...giver.hand.filter((_, index) => index !== giverIndex), returned],
    }),
    { ...partner, hand: [...partner.hand.filter((_, index) => index !== partnerIndex), given] },
  );
  return beginSwap(next, phase.active);
};

const stepStashPut = (
  state: ScapeGoatState,
  phase: Extract<Phase, { kind: "stash-put" }>,
  frame: Frame<ScapeGoatAction>,
): ScapeGoatState => {
  const player = findPlayer(state, phase.active);
  if (player === undefined) return handTurn(state);
  const index = placedIndex(actOf(frame, player.seat), player.hand, "put");
  const card = index === null ? undefined : player.hand[index];
  if (card === undefined) return beginSwap(state, phase.active);
  const hand = player.hand.filter((_, at) => at !== index);
  const next = withPlayer({ ...state, stash: [...state.stash, card] }, { ...player, hand });
  return beginSwap(next, phase.active);
};

/**
 * The frame tiebreak. Iterating canonical seat order makes the earliest-seated
 * framed player win when two colours each frame a different seat; colour order
 * only names the colour, never the winner, because the outcome reads
 * `framed === scapegoat`. A colour present on every reveal has no odd card out, so
 * nobody is framed and the attempt fails.
 *
 * A seat missing from `reveals` fails the attempt outright: the rules require
 * every player to pick, and framing a silent seat would let a network hiccup
 * decide the game.
 */
export const resolveFrame = (
  seats: readonly SeatId[],
  reveals: ReadonlyMap<SeatId, CardId>,
): { readonly framed: SeatId | null; readonly colour: Colour | null } => {
  if (seats.length < MIN_SEATS) return { framed: null, colour: null };
  if (seats.some((seat) => !reveals.has(seat))) return { framed: null, colour: null };
  for (const seat of seats) {
    const own = coloursOf(reveals.get(seat) ?? null);
    for (const colour of COLOURS) {
      if (own.includes(colour)) continue;
      const matched = seats.every(
        (other) => other === seat || coloursOf(reveals.get(other) ?? null).includes(colour),
      );
      if (matched) return { framed: seat, colour };
    }
  }
  return { framed: null, colour: null };
};

const stepFrameReveal = (
  state: ScapeGoatState,
  phase: Extract<Phase, { kind: "frame-reveal" }>,
  frame: Frame<ScapeGoatAction>,
): ScapeGoatState => {
  const seats = activeSeats(state);
  const reveals = new Map<SeatId, CardId>();
  const shown: FrameReveal[] = [];
  for (const seat of seats) {
    const player = findPlayer(state, seat);
    if (player === undefined) continue;
    const index = pickIndex(actOf(frame, seat), player.hand);
    const card = index === null ? undefined : player.hand[index];
    if (card === undefined) continue;
    reveals.set(seat, card);
    shown.push({ seat, card });
  }
  const resolved = resolveFrame(seats, reveals);
  const record: FrameRecord = {
    framer: phase.active,
    reveals: shown,
    framed: resolved.framed,
    colour: resolved.colour,
  };
  if (resolved.framed === null) {
    return beginSwap({ ...state, frame: record }, phase.active);
  }
  return endFrame({ ...state, frame: record }, phase.active, resolved.framed);
};

const stepSwap = (
  state: ScapeGoatState,
  phase: Extract<Phase, { kind: "swap" }>,
  frame: Frame<ScapeGoatAction>,
): ScapeGoatState => {
  const player = findPlayer(state, phase.active);
  if (player === undefined || player.at === "cops") return handTurn(state);
  const index = swapIndex(state, player, actOf(frame, player.seat));
  const placed = index === null ? undefined : player.hand[index];
  if (placed === undefined) return handTurn(state);
  const hand = [...player.hand.filter((_, at) => at !== index), state.faceUp[player.at]];
  const next = withPlayer(
    { ...state, faceUp: { ...state.faceUp, [player.at]: placed } },
    { ...player, hand },
  );
  return handTurn(next);
};

/**
 * The pure fold. Total over every input: an illegal or hostile report coerces to
 * its location's safe default, a resigning active seat hands the turn on, and a
 * table reduced below three seats abandons. `rng` is accepted and ignored — every
 * shuffle happened once in `genesis`.
 */
export const step = (
  state: ScapeGoatState,
  frame: Frame<ScapeGoatAction>,
  _rng: Random,
): ScapeGoatState => {
  if (isTerminal(state)) return state;
  const folded = foldResigns(state, frame);
  if (activeSeats(folded).length < MIN_SEATS) return endAbandoned(folded);
  const active = phaseActive(folded.phase);
  if (active === null) return folded;
  // The six-player antipode shares the move frame with the active seat, and its
  // run to the cops is not conditioned on the active seat acting. Scan the frame
  // for it before anything else, so a resigning active seat cannot discard it.
  if (folded.phase.kind === "move") {
    const ran = copsRunInFrame(folded, moveOwed(folded, active), frame);
    if (ran !== null) return endCops(folded, ran);
  }
  const leaving = folded.resigned.includes(active);
  // A seat that resigns out of the one phase that owes it a card still returns the
  // card first. Every other phase leaves the action undone and the turn passes
  // on, so the turn advances exactly once: stepSwap and stepStashPut do not
  // advance it themselves, handTurn is the single place that does.
  if (leaving && !DEBT_PHASES.has(folded.phase.kind)) return handTurn(folded);
  const foldedNext = runPhase(folded, frame);
  return leaving ? handTurn(foldedNext) : foldedNext;
};

const runPhase = (state: ScapeGoatState, frame: Frame<ScapeGoatAction>): ScapeGoatState => {
  switch (state.phase.kind) {
    case "move":
      return stepMove(state, state.phase, frame);
    case "action":
      return stepAction(state, state.phase, frame);
    case "trade-give":
      return stepTrade(state, state.phase, frame);
    case "stash-put":
      return stepStashPut(state, state.phase, frame);
    case "frame-reveal":
      return stepFrameReveal(state, state.phase, frame);
    case "swap":
      return stepSwap(state, state.phase, frame);
    case "over":
      return state;
    default: {
      const exhausted: never = state.phase;
      return exhausted;
    }
  }
};

/**
 * The seats owed in the open phase, in canonical order. Non-terminal phases always
 * name at least the active seat, and a resigned active seat never persists in a
 * committed state — `step` hands the turn on first. The final guard keeps the
 * contract total anyway: a non-terminal state must never owe nothing, or the
 * session would seal empty frames forever.
 */
export const seatsOwedNow = (state: ScapeGoatState): readonly SeatId[] => {
  const owed = phaseOwed(state);
  if (owed.length > 0 || isTerminal(state)) return owed;
  return activeSeats(state);
};

const phaseOwed = (state: ScapeGoatState): readonly SeatId[] => {
  if (isTerminal(state)) return [];
  switch (state.phase.kind) {
    case "move":
      return moveOwed(state, state.phase.active).filter((seat) => !state.resigned.includes(seat));
    case "action":
      return [state.phase.active];
    case "trade-give":
      return [state.phase.active, state.phase.target].filter(
        (seat) => !state.resigned.includes(seat),
      );
    case "stash-put":
      return [state.phase.active].filter((seat) => !state.resigned.includes(seat));
    case "frame-reveal":
      return activeSeats(state);
    case "swap":
      return [state.phase.active].filter((seat) => !state.resigned.includes(seat));
    case "over":
      return [];
    default: {
      const exhausted: never = state.phase;
      return exhausted;
    }
  }
};

export const seatsOwed = (state: ScapeGoatState, _index: FrameIndex): readonly SeatId[] =>
  seatsOwedNow(state);

/**
 * Terminal once the game is over. The abandoned outcome folds in here, not into an
 * empty owed set: a table that resigns below three seats must terminate, and an
 * empty owed set on a non-terminal state is a contract violation the session
 * raises.
 */
export const isTerminal = (state: ScapeGoatState): boolean =>
  state.phase.kind === "over" || activeSeats(state).length < MIN_SEATS;

/** The outcome of a finished game, or null while it runs. Derived so a shrunk table reads abandoned. */
export const outcomeOf = (state: ScapeGoatState): Outcome | null => {
  if (state.phase.kind === "over") return state.phase.outcome;
  if (activeSeats(state).length < MIN_SEATS) return { kind: "abandoned" };
  return null;
};
