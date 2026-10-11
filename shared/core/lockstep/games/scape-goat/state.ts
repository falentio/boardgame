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
import { ScapeGoatError } from "./error.ts";
import { cardFaceOf, cardId, type CardId } from "./cards.ts";

export type PlayerCount = 3 | 4 | 5 | 6;
export const MIN_SEATS = 3;
export const MAX_SEATS = 6;

/** The four non-Cops locations, in the left-to-right order of the location line. */
export type Destination = "prepare" | "spy" | "trade" | "stash";

/** Every location a token may occupy. Cops is terminal: moving there ends the game. */
export type Location = Destination | "cops";

/** A player colour. `COLOURS[i]` is the colour of the i-th canonical seat. */
export type Colour = "red" | "blue" | "green" | "yellow" | "purple" | "orange";

/**
 * The six player colours in canonical seat order. A card's colours are a subset
 * of these; grey — a card that matches nothing — is the empty subset, not a
 * seventh value, so no colour walk needs an absence case.
 */
export const COLOURS: readonly Colour[] = ["red", "blue", "green", "yellow", "purple", "orange"];

/** The three facedown Stash positions, addressed only by the player picking one. */
export type StashSlot = 0 | 1 | 2;
export const STASH_SLOTS: readonly StashSlot[] = [0, 1, 2];

export type PrepTokensRemaining = 0 | 1 | 2;

export interface PlayerState {
  readonly seat: SeatId;
  readonly at: Location;
  readonly hand: readonly CardId[];
  readonly prepTokens: PrepTokensRemaining;
}

/**
 * One seat's Spy action. The fact of the spy and its target are always public;
 * `reveal` carries the lobby's visibility choice and `hand` the shown cards,
 * which `project` drops unless the viewer is the spy or the mode is public.
 */
export interface SpyRecord {
  readonly spy: SeatId;
  readonly target: SeatId;
  readonly reveal: "private" | "public";
  readonly hand: readonly CardId[];
}

export interface FrameReveal {
  readonly seat: SeatId;
  readonly card: CardId;
}

/** The resolved record of the last Frame Attempt; `framed` is null when it failed. */
export interface FrameRecord {
  readonly framer: SeatId;
  readonly reveals: readonly FrameReveal[];
  readonly framed: SeatId | null;
  readonly colour: Colour | null;
}

export type Outcome =
  | { readonly kind: "cops"; readonly actor: SeatId }
  | { readonly kind: "frame"; readonly actor: SeatId; readonly framed: SeatId | null }
  | { readonly kind: "abandoned" };

/**
 * The whole turn is one payload-carrying phase. Nothing nests and nothing
 * interrupts, so this single union drives both `seatsOwed` and `step`; a new
 * phase kind becomes a compile error in both switches.
 */
export type Phase =
  | { readonly kind: "move"; readonly active: SeatId }
  | { readonly kind: "action"; readonly active: SeatId; readonly location: Destination }
  | { readonly kind: "trade-give"; readonly active: SeatId; readonly target: SeatId }
  | { readonly kind: "stash-put"; readonly active: SeatId }
  | { readonly kind: "frame-reveal"; readonly active: SeatId }
  | { readonly kind: "swap"; readonly active: SeatId }
  | { readonly kind: "over"; readonly outcome: Outcome };

export interface ScapeGoatState {
  readonly players: readonly PlayerState[];
  /** The true scapegoat. Secret: only the other seats' mats name it. */
  readonly scapegoat: SeatId;
  /** The seat the scapegoat's own mat names; always another seat, so no mat names its owner. */
  readonly scapegoatSuspect: SeatId;
  readonly faceUp: Readonly<Record<Destination, CardId>>;
  readonly stash: readonly CardId[];
  readonly prepareTokens: PrepTokensRemaining;
  readonly spy: SpyRecord | null;
  readonly frame: FrameRecord | null;
  readonly phase: Phase;
  readonly resigned: readonly SeatId[];
  /** Lobby choice, carried in state so `step` and `project` can both honour it. */
  readonly spyReveal: "private" | "public";
}

/**
 * The seat whose mat names the scapegoat for `seat`: the true scapegoat for every
 * other seat, the decoy for the scapegoat itself. Derived rather than stored, so
 * the suspect map cannot drift out of agreement with the scapegoat, and the game's
 * central invariant — no player sees their own colour as their suspect — holds by
 * construction.
 */
export const suspectOf = (state: ScapeGoatState, seat: SeatId): SeatId =>
  seat === state.scapegoat ? state.scapegoatSuspect : state.scapegoat;

const PREP_TOKENS: readonly PrepTokensRemaining[] = [0, 1, 2];

const decodeSeat = (json: Json, what: string): SeatId => seatId(expectString(json, what));

/**
 * A card id is only a card if the catalog carries it, so decode at the boundary
 * rather than letting an unknown string through: `coloursOf` would read it as
 * grey, which silently changes how the game folds.
 */
const decodeCardId = (json: Json, what: string): CardId => {
  const value = cardId(expectString(json, what));
  if (cardFaceOf(value) === null) throw new ScapeGoatError(`${what}: unknown card ${value}`);
  return value;
};

const decodeNullableSeat = (json: Json, what: string): SeatId | null =>
  json === null ? null : decodeSeat(json, what);

export const decodeDestination = (json: Json, what: string): Destination => {
  const value = expectString(json, what);
  if (value === "prepare" || value === "spy" || value === "trade" || value === "stash") return value;
  throw new ScapeGoatError(`${what}: unknown destination ${value}`);
};

export const decodeLocation = (json: Json, what: string): Location => {
  const value = expectString(json, what);
  return value === "cops" ? value : decodeDestination(json, what);
};

const decodeColour = (json: Json, what: string): Colour => {
  const value = expectString(json, what);
  const colour = COLOURS.find((candidate) => candidate === value);
  if (colour === undefined) throw new ScapeGoatError(`${what}: unknown colour ${value}`);
  return colour;
};

const decodePrepTokens = (json: Json, what: string): PrepTokensRemaining => {
  const value = expectInteger(json, what);
  const tokens = PREP_TOKENS.find((candidate) => candidate === value);
  if (tokens === undefined) {
    throw new ScapeGoatError(`${what}: preparation tokens must be 0, 1, or 2, got ${String(value)}`);
  }
  return tokens;
};

const decodeRevealMode = (json: Json, what: string): "private" | "public" => {
  const value = expectString(json, what);
  if (value === "private" || value === "public") return value;
  throw new ScapeGoatError(`${what}: unknown reveal mode ${value}`);
};

const encodeOutcome = (outcome: Outcome): Json => {
  switch (outcome.kind) {
    case "cops":
      return { kind: "cops", actor: outcome.actor };
    case "frame":
      return { kind: "frame", actor: outcome.actor, framed: outcome.framed };
    case "abandoned":
      return { kind: "abandoned" };
  }
};

const decodeOutcome = (json: Json): Outcome => {
  const object = expectObject(json, "outcome");
  const kind = expectString(field(object, "kind"), "outcome kind");
  switch (kind) {
    case "cops":
      return { kind: "cops", actor: decodeSeat(field(object, "actor"), "outcome actor") };
    case "frame":
      return {
        kind: "frame",
        actor: decodeSeat(field(object, "actor"), "outcome actor"),
        framed: decodeNullableSeat(field(object, "framed"), "outcome framed"),
      };
    case "abandoned":
      return { kind: "abandoned" };
    default:
      throw new ScapeGoatError(`unknown outcome: ${kind}`);
  }
};

const encodePhase = (phase: Phase): Json => {
  switch (phase.kind) {
    case "move":
      return { kind: "move", active: phase.active };
    case "action":
      return { kind: "action", active: phase.active, location: phase.location };
    case "trade-give":
      return { kind: "trade-give", active: phase.active, target: phase.target };
    case "stash-put":
      return { kind: "stash-put", active: phase.active };
    case "frame-reveal":
      return { kind: "frame-reveal", active: phase.active };
    case "swap":
      return { kind: "swap", active: phase.active };
    case "over":
      return { kind: "over", outcome: encodeOutcome(phase.outcome) };
  }
};

const decodePhase = (json: Json): Phase => {
  const object = expectObject(json, "phase");
  const kind = expectString(field(object, "kind"), "phase kind");
  switch (kind) {
    case "move":
      return { kind: "move", active: decodeSeat(field(object, "active"), "phase active") };
    case "action":
      return {
        kind: "action",
        active: decodeSeat(field(object, "active"), "phase active"),
        location: decodeDestination(field(object, "location"), "phase location"),
      };
    case "trade-give":
      return {
        kind: "trade-give",
        active: decodeSeat(field(object, "active"), "phase active"),
        target: decodeSeat(field(object, "target"), "phase target"),
      };
    case "stash-put":
      return { kind: "stash-put", active: decodeSeat(field(object, "active"), "phase active") };
    case "frame-reveal":
      return { kind: "frame-reveal", active: decodeSeat(field(object, "active"), "phase active") };
    case "swap":
      return { kind: "swap", active: decodeSeat(field(object, "active"), "phase active") };
    case "over":
      return { kind: "over", outcome: decodeOutcome(field(object, "outcome")) };
    default:
      throw new ScapeGoatError(`unknown phase: ${kind}`);
  }
};

const encodePlayer = (player: PlayerState): Json => ({
  seat: player.seat,
  at: player.at,
  hand: [...player.hand],
  prepTokens: player.prepTokens,
});

const decodePlayer = (json: Json): PlayerState => {
  const object = expectObject(json, "player");
  return {
    seat: decodeSeat(field(object, "seat"), "player seat"),
    at: decodeLocation(field(object, "at"), "player location"),
    hand: expectArray(field(object, "hand"), "player hand").map((entry) =>
      decodeCardId(entry, "hand card"),
    ),
    prepTokens: decodePrepTokens(field(object, "prepTokens"), "player prep tokens"),
  };
};

const encodeSpy = (spy: SpyRecord): Json => ({
  spy: spy.spy,
  target: spy.target,
  reveal: spy.reveal,
  hand: [...spy.hand],
});

const decodeSpy = (json: Json): SpyRecord | null => {
  if (json === null) return null;
  const object = expectObject(json, "spy record");
  return {
    spy: decodeSeat(field(object, "spy"), "spy seat"),
    target: decodeSeat(field(object, "target"), "spy target"),
    reveal: decodeRevealMode(field(object, "reveal"), "spy reveal"),
    hand: expectArray(field(object, "hand"), "spy hand").map((entry) =>
      decodeCardId(entry, "spy card"),
    ),
  };
};

const encodeFrame = (frame: FrameRecord): Json => ({
  framer: frame.framer,
  reveals: frame.reveals.map((reveal): Json => ({ seat: reveal.seat, card: reveal.card })),
  framed: frame.framed,
  colour: frame.colour,
});

const decodeFrame = (json: Json): FrameRecord | null => {
  if (json === null) return null;
  const object = expectObject(json, "frame record");
  const colour = field(object, "colour");
  return {
    framer: decodeSeat(field(object, "framer"), "frame framer"),
    reveals: expectArray(field(object, "reveals"), "frame reveals").map((entry): FrameReveal => {
      const reveal = expectObject(entry, "frame reveal");
      return {
        seat: decodeSeat(field(reveal, "seat"), "reveal seat"),
        card: decodeCardId(field(reveal, "card"), "reveal card"),
      };
    }),
    framed: decodeNullableSeat(field(object, "framed"), "frame framed"),
    colour: colour === null ? null : decodeColour(colour, "frame colour"),
  };
};

const encodeFaceUp = (faceUp: Readonly<Record<Destination, CardId>>): Json => ({
  prepare: faceUp.prepare,
  spy: faceUp.spy,
  trade: faceUp.trade,
  stash: faceUp.stash,
});

const decodeFaceUp = (json: Json): Readonly<Record<Destination, CardId>> => {
  const object = expectObject(json, "face-up cards");
  return {
    prepare: decodeCardId(field(object, "prepare"), "face-up prepare"),
    spy: decodeCardId(field(object, "spy"), "face-up spy"),
    trade: decodeCardId(field(object, "trade"), "face-up trade"),
    stash: decodeCardId(field(object, "stash"), "face-up stash"),
  };
};

/**
 * The rules the shape checks cannot express. The seed chain is a convergence
 * check, not a validator: it proves that every peer folded the same frames to the
 * same state, not that the state is legal. A peer that sends a snapshot with a
 * well-typed but self-suspect state therefore chains cleanly, and without this
 * gate `project` would tell a seat it is its own suspect, which is the one hidden
 * fact the game depends on. Decode is the boundary every untrusted state
 * crosses, so the invariants live here rather than in the fold.
 */
const checkInvariants = (state: ScapeGoatState): void => {
  const seats = new Set(state.players.map((player) => player.seat));
  if (!seats.has(state.scapegoat)) {
    throw new ScapeGoatError("the scapegoat is not a player");
  }
  if (!seats.has(state.scapegoatSuspect)) {
    throw new ScapeGoatError("the scapegoat suspect is not a player");
  }
  if (state.scapegoatSuspect === state.scapegoat) {
    throw new ScapeGoatError("the scapegoat must suspect a seat other than itself");
  }
  const held = new Set<CardId>();
  for (const card of Object.values(state.faceUp)) {
    if (held.has(card)) throw new ScapeGoatError("a card is in two places");
    held.add(card);
  }
  for (const card of state.stash) {
    if (held.has(card)) throw new ScapeGoatError("a card is in two places");
    held.add(card);
  }
  for (const player of state.players) {
    for (const card of player.hand) {
      if (held.has(card)) throw new ScapeGoatError("a card is in two places");
      held.add(card);
    }
  }
};

export const stateCodec: Codec<ScapeGoatState> = {
  encode: (state): Json => ({
    players: state.players.map(encodePlayer),
    scapegoat: state.scapegoat,
    scapegoatSuspect: state.scapegoatSuspect,
    faceUp: encodeFaceUp(state.faceUp),
    stash: [...state.stash],
    prepareTokens: state.prepareTokens,
    spy: state.spy === null ? null : encodeSpy(state.spy),
    frame: state.frame === null ? null : encodeFrame(state.frame),
    phase: encodePhase(state.phase),
    resigned: [...state.resigned],
    spyReveal: state.spyReveal,
  }),
  decode: (json): ScapeGoatState => {
    const object = expectObject(json, "scape-goat state");
    const state: ScapeGoatState = {
      players: expectArray(field(object, "players"), "players").map(decodePlayer),
      scapegoat: decodeSeat(field(object, "scapegoat"), "scapegoat"),
      scapegoatSuspect: decodeSeat(field(object, "scapegoatSuspect"), "scapegoat suspect"),
      faceUp: decodeFaceUp(field(object, "faceUp")),
      stash: expectArray(field(object, "stash"), "stash").map((entry) =>
        decodeCardId(entry, "stash card"),
      ),
      prepareTokens: decodePrepTokens(field(object, "prepareTokens"), "prepare tokens"),
      spy: decodeSpy(field(object, "spy")),
      frame: decodeFrame(field(object, "frame")),
      phase: decodePhase(field(object, "phase")),
      resigned: expectArray(field(object, "resigned"), "resigned").map((entry) =>
        decodeSeat(entry, "resigned seat"),
      ),
      spyReveal: decodeRevealMode(field(object, "spyReveal"), "spyReveal"),
    };
    checkInvariants(state);
    return state;
  },
};
