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
import { asCharacterId, type CharacterId } from "./characters.ts";
import { isDistrictId, type DistrictId, type DistrictType } from "./districts.ts";
import { CitadelsError } from "./error.ts";

/**
 * A district sitting in a city. `gold` is the Artist's beautify marker.
 * `cards` holds the cards the Museum tucks under it, and `declaredType` is the
 * colour a district such as the Haunted Quarter counts as when its owner names
 * one; absent means the catalog type.
 */
export interface PlacedDistrict {
  readonly id: DistrictId;
  readonly gold: number;
  readonly cards?: readonly DistrictId[];
  readonly declaredType?: DistrictType;
}

export interface CitadelsPlayer {
  readonly seat: SeatId;
  readonly gold: number;
  /** Hidden district cards; redacted by `project` for every other seat. */
  readonly hand: readonly DistrictId[];
  /** Public city, in build order. */
  readonly city: readonly PlacedDistrict[];
}

export type Phase = "draft" | "turn" | "over";

/** Who owes input in a window and what shape the legal input takes. */
export type WindowKind = "turn" | "any" | "oneOf" | "targets";

/**
 * Every window any character or district may open, declared once here. The
 * resolver registry is keyed by this union; a worker that needs a new purpose
 * reports it to the coordinator rather than editing this list.
 */
export type WindowPurpose =
  | "draft-pick"
  | "turn"
  | "keep"
  | "choose-character"
  | "choose-seat"
  | "choose-type"
  | "magician-swap"
  | "magician-discard"
  | "seer-give"
  | "seer-receive"
  | "emperor-crown"
  | "abbot-split"
  | "cardinal-gold"
  | "wizard-take"
  | "diplomat-exchange"
  | "marshal-seize"
  | "artist-beautify"
  | "magistrate-confiscate"
  | "blackmailer-resolve"
  | "scholar-keep"
  | "trader-build"
  | "warlord-destroy"
  | "tax-collect"
  | "witch-resume"
  | "queen-income"
  | "thief-rob"
  | "witch-takeover"
  | "blackmailer-threat"
  | "armory-destroy"
  | "theatre-swap";

export interface Window {
  readonly kind: WindowKind;
  readonly purpose: WindowPurpose;
  /** The seats the window names. An `any` window is owed by every live seat. */
  readonly seats: readonly SeatId[];
}

/** One seat's character for the round. Hidden until the rank is called. */
export interface Claim {
  readonly seat: SeatId;
  readonly character: CharacterId;
}

/**
 * The passing character draft. The pool is hidden; each pick window is owed by
 * the seat whose turn it is to choose. `faceup` is public; `facedown` is not.
 */
export interface DraftState {
  /** The passing hand, hidden; the last entry is the top. */
  readonly pool: readonly CharacterId[];
  /** Whose pick window is open. */
  readonly picker: SeatId;
  /** Seats that have yet to pick this round, in pick order, `picker` first. */
  readonly order: readonly SeatId[];
  /** Picks made so far, hidden until the character is called. */
  readonly picks: readonly Claim[];
  /** Public faceup discards. */
  readonly faceup: readonly CharacterId[];
  /** Hidden facedown discards. */
  readonly facedown: readonly CharacterId[];
  /** How many characters each seat drafts (2 in 2- and 3-player games). */
  readonly perSeat: number;
}

/**
 * The character action in flight. A single generous record so any character
 * worker can carry its sub-state without editing this file: the actor and its
 * character, an optional target seat, an optional named character or district
 * type, a card pool in flight, and gold/amount counters.
 */
export interface Pending {
  readonly actor: SeatId;
  readonly character: CharacterId | null;
  readonly target: SeatId | null;
  readonly namedCharacter: CharacterId | null;
  readonly namedType: DistrictType | null;
  /** Cards in flight (a drawn pool, a swap, a scholar keep). */
  readonly cards: readonly DistrictId[];
  readonly gold: number;
  readonly amount: number;
  /** A free-form tag the owning worker sets to disambiguate sub-states. */
  readonly note: string | null;
}

/**
 * The Witch's resumed turn: which seat plays it and as which bewitched
 * character. Her gather already landed on the held turn, so the resume turn
 * takes no gather; this record is the resume's identity, read by seatHolding,
 * buildLimit, and resolveTurn. It is owned here, not by the shared pending slot
 * an effect overwrites when its own turn opens.
 */
export interface Resume {
  /** The Witch's seat, the acting player on the resume. */
  readonly seat: SeatId;
  /** The bewitched character the resume plays as, or null when none. */
  readonly character: CharacterId | null;
}

/**
 * A stack entry. `window` needs input from its seats; `call` advances the rank
 * cursor; `end-turn` closes the character's turn; `end-round` closes the round.
 * Everything below a window is its continuation, so a whole round is a
 * data-driven stack.
 */
export type Step =
  | { readonly kind: "window"; readonly window: Window }
  | { readonly kind: "resolve" }
  | { readonly kind: "arm"; readonly pending: Pending }
  | { readonly kind: "call" }
  | { readonly kind: "end-turn" }
  | { readonly kind: "end-round" };

export interface CitadelsState {
  /** The cast in play, canonical rank order. */
  readonly cast: readonly CharacterId[];
  readonly players: readonly CitadelsPlayer[];
  /** Hidden district deck; redacted by `project`. The last entry is the top. */
  readonly deck: readonly DistrictId[];
  /** Public faceup discard pile. */
  readonly discard: readonly DistrictId[];
  readonly crown: SeatId;
  readonly round: number;
  readonly phase: Phase;
  readonly draft: DraftState | null;
  /** The next rank to call, 1..9, or 10 when the round's ranks are exhausted. */
  readonly callRank: number;
  /** The seat whose character was called. */
  readonly active: SeatId;
  /** The window stack, top first. `steps[0]` is the next thing to do. */
  readonly steps: readonly Step[];
  /** Per-round character assignments, canonical rank order. */
  readonly claimed: readonly Claim[];
  /** Characters skipped this round (Assassin's kill, Blackmailer's bribe). */
  readonly skipped: readonly CharacterId[];
  /** The character action in flight, or null between turns. */
  readonly pending: Pending | null;
  /**
   * The Witch's resumed turn, or null. Set when the resume opens and cleared
   * when the resumed turn ends, so a character effect that overwrites pending
   * cannot clobber the resume identity.
   */
  readonly resume?: Resume | null;
  /** Seats that have finished their city, in completion order. */
  readonly completed: readonly SeatId[];
  /** Seats that resigned. */
  readonly resigned: readonly SeatId[];

  // Cross-turn persistent state. Everything above is turn-local; these five
  // outlive one turn, landing when a named character is later called or carrying
  // between rounds. Engine bookkeeping only: never crossed by `project`.
  /** The character the Thief named this round, or null. Cleared at end of round. */
  readonly robbed?: CharacterId | null;
  /** The character the Witch bewitched this round, or null. */
  readonly bewitched?: CharacterId | null;
  /** The two Blackmailer threat markers: the targeted one first, the decoy second. */
  readonly threats?: readonly CharacterId[];
  /** The three Magistrate warrant markers: the signed (targeted) one first. */
  readonly warrants?: readonly CharacterId[];
  /** Gold accumulated on the Tax Collector's token; carries between rounds. */
  readonly taxPot?: number;
  /**
   * How many limit-counting builds the active seat has made this turn. Absent
   * means zero; `applyEndTurn` resets it. A build whose terms set
   * `countsAsBuild: false` (Stables) never raises it.
   */
  readonly builtThisTurn?: number;
}

const WINDOW_KIND: Record<WindowPurpose, WindowKind> = {
  "draft-pick": "oneOf",
  turn: "turn",
  keep: "oneOf",
  "choose-character": "any",
  "choose-seat": "any",
  "choose-type": "any",
  "magician-swap": "oneOf",
  "magician-discard": "oneOf",
  "seer-give": "oneOf",
  "seer-receive": "oneOf",
  "emperor-crown": "oneOf",
  "abbot-split": "oneOf",
  "cardinal-gold": "targets",
  "wizard-take": "oneOf",
  "diplomat-exchange": "oneOf",
  "marshal-seize": "oneOf",
  "artist-beautify": "oneOf",
  "magistrate-confiscate": "oneOf",
  "blackmailer-resolve": "oneOf",
  "scholar-keep": "oneOf",
  "trader-build": "oneOf",
  "warlord-destroy": "oneOf",
  "tax-collect": "oneOf",
  "witch-resume": "oneOf",
  "queen-income": "oneOf",
  "thief-rob": "oneOf",
  "witch-takeover": "oneOf",
  "blackmailer-threat": "oneOf",
  "armory-destroy": "oneOf",
  "theatre-swap": "oneOf",
};

/**
 * Fill the cross-turn fields a state built before this seam may omit, so every
 * state the engine sees carries them. The codec requires all five; `genesisState`
 * predates them, so `genesis` normalizes here.
 */
export const withCrossTurnDefaults = (state: CitadelsState): CitadelsState => ({
  ...state,
  robbed: state.robbed ?? null,
  bewitched: state.bewitched ?? null,
  threats: state.threats ?? [],
  warrants: state.warrants ?? [],
  taxPot: state.taxPot ?? 0,
  builtThisTurn: state.builtThisTurn ?? 0,
  resume: state.resume ?? null,
});

export const windowKindFor = (purpose: WindowPurpose): WindowKind => WINDOW_KIND[purpose];

export const WINDOW_PURPOSES: readonly WindowPurpose[] = Object.keys(WINDOW_KIND) as WindowPurpose[];

export const asWindowPurpose = (value: string): WindowPurpose => {
  const purpose = WINDOW_PURPOSES.find((candidate) => candidate === value);
  if (purpose === undefined) throw new CitadelsError(`unknown window purpose: ${value}`);
  return purpose;
};

const PHASES: readonly Phase[] = ["draft", "turn", "over"];

export const asPhase = (value: string): Phase => {
  const phase = PHASES.find((candidate) => candidate === value);
  if (phase === undefined) throw new CitadelsError(`unknown phase: ${value}`);
  return phase;
};

const DISTRICT_TYPES: readonly DistrictType[] = [
  "noble",
  "religious",
  "trade",
  "military",
  "unique",
];

export const asDistrictType = (value: string): DistrictType => {
  const type = DISTRICT_TYPES.find((candidate) => candidate === value);
  if (type === undefined) throw new CitadelsError(`unknown district type: ${value}`);
  return type;
};

const decodeSeat = (json: Json, what: string): SeatId => seatId(expectString(json, what));

const decodeNullableSeat = (json: Json, what: string): SeatId | null =>
  json === null ? null : decodeSeat(json, what);

const decodeNullableCharacter = (json: Json, what: string): CharacterId | null =>
  json === null ? null : asCharacterId(expectString(json, what));

const decodeNullableType = (json: Json, what: string): DistrictType | null =>
  json === null ? null : asDistrictType(expectString(json, what));

const decodeResume = (json: Json): Resume | null => {
  if (json === null) return null;
  const object = expectObject(json, "resume");
  return {
    seat: decodeSeat(field(object, "seat"), "resume seat"),
    character: decodeNullableCharacter(field(object, "character"), "resume character"),
  };
};

const decodeDistrict = (json: Json, what: string): DistrictId => {
  const id = expectString(json, what);
  if (!isDistrictId(id)) throw new CitadelsError(`unknown district: ${id}`);
  return id;
};

const decodeDistricts = (json: Json, what: string): readonly DistrictId[] =>
  expectArray(json, what).map((entry) => decodeDistrict(entry, `${what} entry`));

const decodeCharacters = (json: Json, what: string): readonly CharacterId[] =>
  expectArray(json, what).map((entry) => asCharacterId(expectString(entry, `${what} entry`)));

const decodeSeats = (json: Json, what: string): readonly SeatId[] =>
  expectArray(json, what).map((entry) => decodeSeat(entry, `${what} entry`));

/** An optional own field: absent means the value the caller supplies instead. */
const optionalField = (
  object: { readonly [key: string]: Json },
  key: string,
): Json | undefined => (Object.hasOwn(object, key) ? object[key] : undefined);

const decodePlaced = (json: Json): PlacedDistrict => {
  const district = expectObject(json, "placed district");
  const cards = optionalField(district, "cards");
  const declaredType = optionalField(district, "declaredType");
  return {
    id: decodeDistrict(field(district, "id"), "placed district id"),
    gold: expectInteger(field(district, "gold"), "placed district gold"),
    ...(cards === undefined ? {} : { cards: decodeDistricts(cards, "placed district cards") }),
    ...(declaredType === undefined
      ? {}
      : { declaredType: asDistrictType(expectString(declaredType, "placed district type")) }),
  };
};

const encodePlaced = (district: PlacedDistrict): Json => ({
  id: district.id,
  gold: district.gold,
  ...(district.cards === undefined ? {} : { cards: [...district.cards] }),
  ...(district.declaredType === undefined ? {} : { declaredType: district.declaredType }),
});

const decodePlayer = (json: Json): CitadelsPlayer => {
  const object = expectObject(json, "player");
  return {
    seat: decodeSeat(field(object, "seat"), "player seat"),
    gold: expectInteger(field(object, "gold"), "player gold"),
    hand: decodeDistricts(field(object, "hand"), "player hand"),
    city: expectArray(field(object, "city"), "player city").map(decodePlaced),
  };
};

const decodeClaim = (json: Json): Claim => {
  const object = expectObject(json, "claim");
  return {
    seat: decodeSeat(field(object, "seat"), "claim seat"),
    character: asCharacterId(expectString(field(object, "character"), "claim character")),
  };
};

const decodeDraft = (json: Json): DraftState | null => {
  if (json === null) return null;
  const object = expectObject(json, "draft");
  return {
    pool: decodeCharacters(field(object, "pool"), "draft pool"),
    picker: decodeSeat(field(object, "picker"), "draft picker"),
    order: decodeSeats(field(object, "order"), "draft order"),
    picks: expectArray(field(object, "picks"), "draft picks").map(decodeClaim),
    faceup: decodeCharacters(field(object, "faceup"), "draft faceup"),
    facedown: decodeCharacters(field(object, "facedown"), "draft facedown"),
    perSeat: expectInteger(field(object, "perSeat"), "draft perSeat"),
  };
};

const decodePending = (json: Json): Pending | null => {
  if (json === null) return null;
  const object = expectObject(json, "pending");
  return {
    actor: decodeSeat(field(object, "actor"), "pending actor"),
    character: decodeNullableCharacter(field(object, "character"), "pending character"),
    target: decodeNullableSeat(field(object, "target"), "pending target"),
    namedCharacter: decodeNullableCharacter(
      field(object, "namedCharacter"),
      "pending namedCharacter",
    ),
    namedType: decodeNullableType(field(object, "namedType"), "pending namedType"),
    cards: decodeDistricts(field(object, "cards"), "pending cards"),
    gold: expectInteger(field(object, "gold"), "pending gold"),
    amount: expectInteger(field(object, "amount"), "pending amount"),
    note:
      field(object, "note") === null
        ? null
        : expectString(field(object, "note"), "pending note"),
  };
};

const decodeWindow = (json: Json): Window => {
  const object = expectObject(json, "window");
  const purpose = asWindowPurpose(expectString(field(object, "purpose"), "window purpose"));
  const kind = expectString(field(object, "kind"), "window kind");
  if (kind !== windowKindFor(purpose)) {
    throw new CitadelsError(`window purpose ${purpose} must have kind ${windowKindFor(purpose)}`);
  }
  return { kind, purpose, seats: decodeSeats(field(object, "seats"), "window seats") };
};

const decodeStep = (json: Json): Step => {
  const object = expectObject(json, "step");
  const kind = expectString(field(object, "kind"), "step kind");
  switch (kind) {
    case "resolve":
      return { kind: "resolve" };
    case "arm": {
      const pending = decodePending(field(object, "pending"));
      if (pending === null) throw new CitadelsError("arm step requires a pending record");
      return { kind: "arm", pending };
    }
    case "call":
      return { kind: "call" };
    case "end-turn":
      return { kind: "end-turn" };
    case "end-round":
      return { kind: "end-round" };
    case "window":
      return { kind: "window", window: decodeWindow(field(object, "window")) };
    default:
      throw new CitadelsError(`unknown step kind: ${kind}`);
  }
};

const encodeClaim = (claim: Claim): Json => ({ seat: claim.seat, character: claim.character });

const encodeDraft = (draft: DraftState): Json => ({
  pool: [...draft.pool],
  picker: draft.picker,
  order: [...draft.order],
  picks: draft.picks.map(encodeClaim),
  faceup: [...draft.faceup],
  facedown: [...draft.facedown],
  perSeat: draft.perSeat,
});

const encodePending = (pending: Pending): Json => ({
  actor: pending.actor,
  character: pending.character,
  target: pending.target,
  namedCharacter: pending.namedCharacter,
  namedType: pending.namedType,
  cards: [...pending.cards],
  gold: pending.gold,
  amount: pending.amount,
  note: pending.note,
});

const encodeStep = (step: Step): Json => {
  switch (step.kind) {
    case "resolve":
      return { kind: "resolve" };
    case "arm":
      return { kind: "arm", pending: encodePending(step.pending) };
    case "call":
      return { kind: "call" };
    case "end-turn":
      return { kind: "end-turn" };
    case "end-round":
      return { kind: "end-round" };
    case "window":
      return {
        kind: "window",
        window: {
          kind: step.window.kind,
          purpose: step.window.purpose,
          seats: [...step.window.seats],
        },
      };
  }
};

export const stateCodec: Codec<CitadelsState> = {
  encode: (state): Json => ({
    cast: [...state.cast],
    players: state.players.map(
      (player): Json => ({
        seat: player.seat,
        gold: player.gold,
        hand: [...player.hand],
        city: player.city.map(encodePlaced),
      }),
    ),
    deck: [...state.deck],
    discard: [...state.discard],
    crown: state.crown,
    round: state.round,
    phase: state.phase,
    draft: state.draft === null ? null : encodeDraft(state.draft),
    callRank: state.callRank,
    active: state.active,
    steps: state.steps.map(encodeStep),
    claimed: state.claimed.map(encodeClaim),
    skipped: [...state.skipped],
    pending: state.pending === null ? null : encodePending(state.pending),
    completed: [...state.completed],
    resigned: [...state.resigned],
    robbed: state.robbed ?? null,
    bewitched: state.bewitched ?? null,
    threats: [...(state.threats ?? [])],
    warrants: [...(state.warrants ?? [])],
    taxPot: state.taxPot ?? 0,
    builtThisTurn: state.builtThisTurn ?? 0,
    resume:
      state.resume === null || state.resume === undefined
        ? null
        : { seat: state.resume.seat, character: state.resume.character },
  }),
  decode: (json): CitadelsState => {
    const object = expectObject(json, "citadels state");
    return {
      cast: decodeCharacters(field(object, "cast"), "cast"),
      players: expectArray(field(object, "players"), "players").map(decodePlayer),
      deck: decodeDistricts(field(object, "deck"), "deck"),
      discard: decodeDistricts(field(object, "discard"), "discard"),
      crown: decodeSeat(field(object, "crown"), "crown"),
      round: expectInteger(field(object, "round"), "round"),
      phase: asPhase(expectString(field(object, "phase"), "phase")),
      draft: decodeDraft(field(object, "draft")),
      callRank: expectInteger(field(object, "callRank"), "callRank"),
      active: decodeSeat(field(object, "active"), "active"),
      steps: expectArray(field(object, "steps"), "steps").map(decodeStep),
      claimed: expectArray(field(object, "claimed"), "claimed").map(decodeClaim),
      skipped: decodeCharacters(field(object, "skipped"), "skipped"),
      pending: decodePending(field(object, "pending")),
      completed: decodeSeats(field(object, "completed"), "completed"),
      resigned: decodeSeats(field(object, "resigned"), "resigned"),
      robbed: decodeNullableCharacter(field(object, "robbed"), "robbed"),
      bewitched: decodeNullableCharacter(field(object, "bewitched"), "bewitched"),
      threats: decodeCharacters(field(object, "threats"), "threats"),
      warrants: decodeCharacters(field(object, "warrants"), "warrants"),
      taxPot: expectInteger(field(object, "taxPot"), "taxPot"),
      builtThisTurn: expectInteger(field(object, "builtThisTurn"), "builtThisTurn"),
      resume: decodeResume(field(object, "resume")),
    };
  },
};
