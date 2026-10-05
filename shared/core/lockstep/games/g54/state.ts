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
import { G54Error } from "./error.ts";
import type { GeneralActionId } from "./generals.ts";
import { asRoleId, type RoleId } from "./roles.ts";

export interface G54Player {
  readonly seat: SeatId;
  readonly coins: number;
  /** Face-down influence: hidden, one life and one claimable power each. */
  readonly hand: readonly RoleId[];
  /** Face-up influence: public, spent lives that no longer grant a power. */
  readonly revealed: readonly RoleId[];
}

/**
 * Who owes input in a window and what shape the legal input takes. `targets` is
 * the multi-target form (each named seat decides independently).
 */
export type WindowKind = "turn" | "any" | "oneOf" | "targets";

/** What a window is resolving; the resolver registry is keyed by this. */
export type WindowPurpose =
  | "turn"
  | "challenge-claim"
  | "proof-claim"
  | "block"
  | "challenge-block"
  | "proof-block"
  | "reveal"
  | "keep"
  | "crime-pay"
  | "capitalist"
  | "spy-second"
  | "protestor-fund"
  | "producer-give"
  | "writer-draw"
  | "customs-mark"
  | "reactive-intellectual"
  | "reactive-missionary"
  | "lawyer"
  | "bomb"
  | "socialist-give"
  | "socialist-keep"
  | "plantation-payout";

/** Why a seat is about to lose one face-down influence; gates reactive windows. */
export type LossCause = "coup" | "challenge" | "execution";

export interface Window {
  readonly kind: WindowKind;
  readonly purpose: WindowPurpose;
  /**
   * Named seats for `turn`/`oneOf`/`targets`. For an `any` window the owed set is
   * every live seat and `seats` is free to carry a marker (the `lawyer` window
   * stores the eliminated seat here as its clockwise ordering anchor).
   */
  readonly seats: readonly SeatId[];
  /** Why a `reveal` is happening; gates the reactive windows. Null otherwise. */
  readonly cause: LossCause | null;
}

/** The action in flight from its claim until it resolves or fails. */
export interface PendingAction {
  readonly kind: "role" | GeneralActionId;
  readonly claimant: SeatId;
  readonly role: RoleId | null;
  readonly target: SeatId | null;
  /** The role an action names for its own effect (Arms Dealer); null for every other action. */
  readonly named: RoleId | null;
  readonly cost: number;
  readonly costTo: "treasury" | "target";
  readonly blockRole: RoleId | null;
  /** The seat whose block survived, or null when the action was not blocked. */
  readonly blocker: SeatId | null;
  /** Who challenged the claim, set while the claim's proof window is open. */
  readonly challenger: SeatId | null;
  /** Who challenged the block, set while the block's proof window is open. */
  readonly blockChallenger: SeatId | null;
  /** Set once a Protestor kill has been crowdfunded by a third party. */
  readonly funded: boolean;
}

/**
 * A linked claim resolved with the same challenge/proof/block machinery as a main
 * claim but stacked above it: a Capitalist collection, a General or Priest
 * per-target block, a Lawyer claim on an elimination, or a reactive
 * Intellectual/Missionary claim. It is `state.extra`, so the shared claim windows
 * resolve it without the main claim's state interfering.
 */
export interface ExtraClaim {
  readonly kind:
    | "capitalist"
    | "general"
    | "priest"
    | "lawyer"
    | "reactive"
    | "anarchist"
    | "socialist"
    | "plantation";
  readonly claimant: SeatId;
  readonly role: RoleId;
  /** The seat the claim acts on: the payer, the target, or the eliminated seat. */
  readonly target: SeatId;
  readonly blockRole: RoleId | null;
  readonly blocker: SeatId | null;
  readonly challenger: SeatId | null;
  readonly blockChallenger: SeatId | null;
}

/** A Communications swap in progress: the drawn pool the actor is filtering. */
export interface DrawState {
  readonly seat: SeatId;
  readonly pool: readonly RoleId[];
  readonly keepSize: number;
  /** The Producer exchange partner, or null for a plain Court swap. */
  readonly target: SeatId | null;
}

/** The Customs Officer's Tax mark: one role card taxed, paid to the holder. */
export interface TaxMark {
  readonly role: RoleId;
  readonly holder: SeatId;
}

/** A Mercenary Disappear token: resolves after the target's next turn. */
export interface DisappearToken {
  readonly target: SeatId;
  readonly turns: number;
}

/** The Bomb chain: the current holder, the growing prior-holder set, and the named move. */
export interface BombState {
  readonly holder: SeatId;
  readonly prior: readonly SeatId[];
  /** The move named before the challenge window opened; null while the holder is deciding. */
  readonly move: "pass" | "defuse" | null;
}

/** A Socialist sub-turn in progress. */
export interface SocialistState {
  readonly seat: SeatId;
  readonly givers: readonly SeatId[];
  readonly pool: readonly RoleId[];
}

/** The public Arms Dealer reveal: the named role, the two flipped cards, and the match. */
export interface ArmsReveal {
  readonly seat: SeatId;
  readonly named: RoleId;
  readonly cards: readonly RoleId[];
  readonly matched: boolean;
}

/**
 * A stack entry. `window` needs input from its seats; `resolve` pays and applies
 * the active claim; `begin` installs a linked extra claim; `settle` returns an
 * eliminated seat's coins and drops its tokens; `end-turn` advances the active
 * seat. Everything below a window is its continuation, so the whole turn is a
 * data-driven stack.
 */
export type Step =
  | { readonly kind: "window"; readonly window: Window }
  | { readonly kind: "resolve" }
  | { readonly kind: "end-turn" }
  | { readonly kind: "begin"; readonly extra: ExtraClaim }
  | { readonly kind: "settle"; readonly seat: SeatId };

export interface G54State {
  readonly roles: readonly RoleId[];
  readonly players: readonly G54Player[];
  /** Hidden Court deck; redacted by `project`. The last entry is the top. */
  readonly court: readonly RoleId[];
  readonly treasury: number;
  readonly active: SeatId;
  readonly turn: number;
  /** The window stack, top first. `steps[0]` is the next thing to do. */
  readonly steps: readonly Step[];
  readonly pending: PendingAction | null;
  /**
   * Linked claims stacked above the main claim; the last is active. A stack (not
   * a single slot) so a reactive window opened mid-action — during the reveal of
   * a challenge loss — nests above the in-flight extra without losing it.
   */
  readonly extras: readonly ExtraClaim[];
  readonly draw: DrawState | null;
  readonly peacekeeping: SeatId | null;
  /** The two Foreign Consular allies, or empty when no treaty is in force. */
  readonly treaty: readonly SeatId[];
  readonly tax: TaxMark | null;
  readonly disappear: readonly DisappearToken[];
  /** The public Bank pile; 0 unless Financier is in play. */
  readonly bank: number;
  /** Social Media is an available general action for the whole game. */
  readonly socialMedia: boolean;
  readonly bomb: BombState | null;
  readonly socialist: SocialistState | null;
  /** Surviving Plantation Owner claimants, or null when no payout is in flight. */
  readonly plantation: readonly SeatId[] | null;
  /** The last Arms Dealer reveal, public and view-only. */
  readonly arms: ArmsReveal | null;
  /**
   * Seats that resigned. The primitive folds a resign into its roster, but the
   * game must fold it too: a single-seat window naming a resigned seat would
   * otherwise present an empty owed set while the game is not terminal.
   */
  readonly resigned: readonly SeatId[];
}

const WINDOW_KIND: Record<WindowPurpose, WindowKind> = {
  turn: "turn",
  "challenge-claim": "any",
  "proof-claim": "oneOf",
  block: "oneOf",
  "challenge-block": "any",
  "proof-block": "oneOf",
  reveal: "oneOf",
  keep: "oneOf",
  "crime-pay": "oneOf",
  capitalist: "targets",
  "spy-second": "turn",
  "protestor-fund": "targets",
  "producer-give": "oneOf",
  "writer-draw": "oneOf",
  "customs-mark": "oneOf",
  "reactive-intellectual": "oneOf",
  "reactive-missionary": "oneOf",
  lawyer: "any",
  bomb: "oneOf",
  "socialist-give": "oneOf",
  "socialist-keep": "oneOf",
  "plantation-payout": "oneOf",
};

export const windowKindFor = (purpose: WindowPurpose): WindowKind => WINDOW_KIND[purpose];

const WINDOW_PURPOSES: readonly WindowPurpose[] = [
  "turn",
  "challenge-claim",
  "proof-claim",
  "block",
  "challenge-block",
  "proof-block",
  "reveal",
  "keep",
  "crime-pay",
  "capitalist",
  "spy-second",
  "protestor-fund",
  "producer-give",
  "writer-draw",
  "customs-mark",
  "reactive-intellectual",
  "reactive-missionary",
  "lawyer",
  "bomb",
  "socialist-give",
  "socialist-keep",
  "plantation-payout",
];

const asWindowPurpose = (value: string): WindowPurpose => {
  const purpose = WINDOW_PURPOSES.find((candidate) => candidate === value);
  if (purpose === undefined) throw new G54Error(`unknown window purpose: ${value}`);
  return purpose;
};

const LOSS_CAUSES: readonly LossCause[] = ["coup", "challenge", "execution"];

const asLossCause = (value: string): LossCause => {
  const cause = LOSS_CAUSES.find((candidate) => candidate === value);
  if (cause === undefined) throw new G54Error(`unknown loss cause: ${value}`);
  return cause;
};

const decodeNullableCause = (json: Json, what: string): LossCause | null =>
  json === null ? null : asLossCause(expectString(json, what));

const EXTRA_KINDS: readonly ExtraClaim["kind"][] = [
  "capitalist",
  "general",
  "priest",
  "lawyer",
  "reactive",
  "anarchist",
  "socialist",
  "plantation",
];

const asExtraKind = (value: string): ExtraClaim["kind"] => {
  const kind = EXTRA_KINDS.find((candidate) => candidate === value);
  if (kind === undefined) throw new G54Error(`unknown extra kind: ${value}`);
  return kind;
};

const decodeRoles = (json: Json, what: string): readonly RoleId[] =>
  expectArray(json, what).map((entry) => asRoleId(expectString(entry, `${what} entry`)));

const encodeRoles = (roles: readonly RoleId[]): Json => roles.map((role): Json => role);

const decodeSeat = (json: Json, what: string): SeatId => seatId(expectString(json, what));

const decodeNullableSeat = (json: Json, what: string): SeatId | null =>
  json === null ? null : decodeSeat(json, what);

const decodeNullableRole = (json: Json, what: string): RoleId | null =>
  json === null ? null : asRoleId(expectString(json, what));

const GENERAL_ACTION_IDS: readonly GeneralActionId[] = ["income", "coup", "bank", "social-media"];

const expectBoolean = (value: Json, what: string): boolean => {
  if (typeof value !== "boolean") throw new G54Error(`${what}: expected a boolean`);
  return value;
};

const decodePlayer = (json: Json): G54Player => {
  const object = expectObject(json, "player");
  return {
    seat: decodeSeat(field(object, "seat"), "player seat"),
    coins: expectInteger(field(object, "coins"), "player coins"),
    hand: decodeRoles(field(object, "hand"), "player hand"),
    revealed: decodeRoles(field(object, "revealed"), "player revealed"),
  };
};

const decodeWindow = (json: Json): Window => {
  const object = expectObject(json, "window");
  const purpose = asWindowPurpose(expectString(field(object, "purpose"), "window purpose"));
  const kind = expectString(field(object, "kind"), "window kind");
  if (kind !== windowKindFor(purpose)) {
    throw new G54Error(`window purpose ${purpose} must have kind ${windowKindFor(purpose)}`);
  }
  return {
    kind,
    purpose,
    seats: expectArray(field(object, "seats"), "window seats").map((entry) =>
      decodeSeat(entry, "window seat"),
    ),
    cause: decodeNullableCause(field(object, "cause"), "window cause"),
  };
};

const decodePending = (json: Json): PendingAction | null => {
  if (json === null) return null;
  const object = expectObject(json, "pending action");
  const kind = expectString(field(object, "kind"), "pending kind");
  if (!GENERAL_ACTION_IDS.some((id) => id === kind) && kind !== "role") {
    throw new G54Error(`unknown pending kind: ${kind}`);
  }
  const costTo = expectString(field(object, "costTo"), "pending costTo");
  if (costTo !== "treasury" && costTo !== "target") {
    throw new G54Error(`unknown pending costTo: ${costTo}`);
  }
  return {
    kind: kind as PendingAction["kind"],
    claimant: decodeSeat(field(object, "claimant"), "pending claimant"),
    role: decodeNullableRole(field(object, "role"), "pending role"),
    target: decodeNullableSeat(field(object, "target"), "pending target"),
    named: decodeNullableRole(field(object, "named"), "pending named"),
    cost: expectInteger(field(object, "cost"), "pending cost"),
    costTo,
    blockRole: decodeNullableRole(field(object, "blockRole"), "pending blockRole"),
    blocker: decodeNullableSeat(field(object, "blocker"), "pending blocker"),
    challenger: decodeNullableSeat(field(object, "challenger"), "pending challenger"),
    blockChallenger: decodeNullableSeat(
      field(object, "blockChallenger"),
      "pending blockChallenger",
    ),
    funded: expectBoolean(field(object, "funded"), "pending funded"),
  };
};

const encodePending = (pending: PendingAction): Json => ({
  kind: pending.kind,
  claimant: pending.claimant,
  role: pending.role,
  target: pending.target,
  named: pending.named,
  cost: pending.cost,
  costTo: pending.costTo,
  blockRole: pending.blockRole,
  blocker: pending.blocker,
  challenger: pending.challenger,
  blockChallenger: pending.blockChallenger,
  funded: pending.funded,
});

const decodeExtra = (json: Json): ExtraClaim => {
  const object = expectObject(json, "extra claim");
  return {
    kind: asExtraKind(expectString(field(object, "kind"), "extra kind")),
    claimant: decodeSeat(field(object, "claimant"), "extra claimant"),
    role: asRoleId(expectString(field(object, "role"), "extra role")),
    target: decodeSeat(field(object, "target"), "extra target"),
    blockRole: decodeNullableRole(field(object, "blockRole"), "extra blockRole"),
    blocker: decodeNullableSeat(field(object, "blocker"), "extra blocker"),
    challenger: decodeNullableSeat(field(object, "challenger"), "extra challenger"),
    blockChallenger: decodeNullableSeat(field(object, "blockChallenger"), "extra blockChallenger"),
  };
};

const encodeExtra = (extra: ExtraClaim): Json => ({
  kind: extra.kind,
  claimant: extra.claimant,
  role: extra.role,
  target: extra.target,
  blockRole: extra.blockRole,
  blocker: extra.blocker,
  challenger: extra.challenger,
  blockChallenger: extra.blockChallenger,
});

const decodeStep = (json: Json): Step => {
  const object = expectObject(json, "step");
  const kind = expectString(field(object, "kind"), "step kind");
  switch (kind) {
    case "resolve":
      return { kind: "resolve" };
    case "end-turn":
      return { kind: "end-turn" };
    case "window":
      return { kind: "window", window: decodeWindow(field(object, "window")) };
    case "begin":
      return { kind: "begin", extra: decodeExtra(field(object, "extra")) };
    case "settle":
      return { kind: "settle", seat: decodeSeat(field(object, "seat"), "settle seat") };
    default:
      throw new G54Error(`unknown step kind: ${kind}`);
  }
};

const encodeStep = (step: Step): Json => {
  switch (step.kind) {
    case "resolve":
      return { kind: "resolve" };
    case "end-turn":
      return { kind: "end-turn" };
    case "window":
      return {
        kind: "window",
        window: {
          kind: step.window.kind,
          purpose: step.window.purpose,
          seats: [...step.window.seats],
          cause: step.window.cause,
        },
      };
    case "begin":
      return { kind: "begin", extra: encodeExtra(step.extra) };
    case "settle":
      return { kind: "settle", seat: step.seat };
  }
};

const decodeDraw = (json: Json): DrawState | null => {
  if (json === null) return null;
  const object = expectObject(json, "draw state");
  return {
    seat: decodeSeat(field(object, "seat"), "draw seat"),
    pool: decodeRoles(field(object, "pool"), "draw pool"),
    keepSize: expectInteger(field(object, "keepSize"), "draw keepSize"),
    target: decodeNullableSeat(field(object, "target"), "draw target"),
  };
};

const decodeTax = (json: Json): TaxMark | null => {
  if (json === null) return null;
  const object = expectObject(json, "tax mark");
  return {
    role: asRoleId(expectString(field(object, "role"), "tax role")),
    holder: decodeSeat(field(object, "holder"), "tax holder"),
  };
};

const decodeDisappear = (json: Json): DisappearToken => {
  const object = expectObject(json, "disappear token");
  return {
    target: decodeSeat(field(object, "target"), "disappear target"),
    turns: expectInteger(field(object, "turns"), "disappear turns"),
  };
};

const decodeBomb = (json: Json): BombState | null => {
  if (json === null) return null;
  const object = expectObject(json, "bomb");
  const move = field(object, "move");
  const moveValue = move === null ? null : expectString(move, "bomb move");
  if (moveValue !== null && moveValue !== "pass" && moveValue !== "defuse") {
    throw new G54Error(`unknown bomb move: ${moveValue}`);
  }
  return {
    holder: decodeSeat(field(object, "holder"), "bomb holder"),
    prior: expectArray(field(object, "prior"), "bomb prior").map((entry) =>
      decodeSeat(entry, "bomb prior seat"),
    ),
    move: moveValue,
  };
};

const encodeBomb = (bomb: BombState): Json => ({
  holder: bomb.holder,
  prior: [...bomb.prior],
  move: bomb.move,
});

const decodeSocialist = (json: Json): SocialistState | null => {
  if (json === null) return null;
  const object = expectObject(json, "socialist");
  return {
    seat: decodeSeat(field(object, "seat"), "socialist seat"),
    givers: expectArray(field(object, "givers"), "socialist givers").map((entry) =>
      decodeSeat(entry, "socialist giver"),
    ),
    pool: decodeRoles(field(object, "pool"), "socialist pool"),
  };
};

const encodeSocialist = (socialist: SocialistState): Json => ({
  seat: socialist.seat,
  givers: [...socialist.givers],
  pool: encodeRoles(socialist.pool),
});

const decodeArms = (json: Json): ArmsReveal | null => {
  if (json === null) return null;
  const object = expectObject(json, "arms reveal");
  return {
    seat: decodeSeat(field(object, "seat"), "arms seat"),
    named: asRoleId(expectString(field(object, "named"), "arms named")),
    cards: decodeRoles(field(object, "cards"), "arms cards"),
    matched: expectBoolean(field(object, "matched"), "arms matched"),
  };
};

const encodeArms = (arms: ArmsReveal): Json => ({
  seat: arms.seat,
  named: arms.named,
  cards: encodeRoles(arms.cards),
  matched: arms.matched,
});

export const stateCodec: Codec<G54State> = {
  encode: (state): Json => ({
    roles: encodeRoles(state.roles),
    players: state.players.map((player): Json => ({
      seat: player.seat,
      coins: player.coins,
      hand: encodeRoles(player.hand),
      revealed: encodeRoles(player.revealed),
    })),
    court: encodeRoles(state.court),
    treasury: state.treasury,
    active: state.active,
    turn: state.turn,
    steps: state.steps.map(encodeStep),
    pending: state.pending === null ? null : encodePending(state.pending),
    extras: state.extras.map(encodeExtra),
    draw:
      state.draw === null
        ? null
        : {
            seat: state.draw.seat,
            pool: encodeRoles(state.draw.pool),
            keepSize: state.draw.keepSize,
            target: state.draw.target,
          },
    peacekeeping: state.peacekeeping,
    treaty: [...state.treaty],
    tax: state.tax === null ? null : { role: state.tax.role, holder: state.tax.holder },
    disappear: state.disappear.map((token): Json => ({ target: token.target, turns: token.turns })),
    bank: state.bank,
    socialMedia: state.socialMedia,
    bomb: state.bomb === null ? null : encodeBomb(state.bomb),
    socialist: state.socialist === null ? null : encodeSocialist(state.socialist),
    plantation: state.plantation === null ? null : [...state.plantation],
    arms: state.arms === null ? null : encodeArms(state.arms),
    resigned: [...state.resigned],
  }),
  decode: (json): G54State => {
    const object = expectObject(json, "g54 state");
    return {
      roles: decodeRoles(field(object, "roles"), "roles"),
      players: expectArray(field(object, "players"), "players").map(decodePlayer),
      court: decodeRoles(field(object, "court"), "court"),
      treasury: expectInteger(field(object, "treasury"), "treasury"),
      active: decodeSeat(field(object, "active"), "active"),
      turn: expectInteger(field(object, "turn"), "turn"),
      steps: expectArray(field(object, "steps"), "steps").map(decodeStep),
      pending: decodePending(field(object, "pending")),
      extras: expectArray(field(object, "extras"), "extras").map(decodeExtra),
      draw: decodeDraw(field(object, "draw")),
      peacekeeping: decodeNullableSeat(field(object, "peacekeeping"), "peacekeeping"),
      treaty: expectArray(field(object, "treaty"), "treaty").map((entry) =>
        decodeSeat(entry, "treaty seat"),
      ),
      tax: decodeTax(field(object, "tax")),
      disappear: expectArray(field(object, "disappear"), "disappear").map(decodeDisappear),
      bank: expectInteger(field(object, "bank"), "bank"),
      socialMedia: expectBoolean(field(object, "socialMedia"), "socialMedia"),
      bomb: decodeBomb(field(object, "bomb")),
      socialist: decodeSocialist(field(object, "socialist")),
      plantation:
        field(object, "plantation") === null
          ? null
          : expectArray(field(object, "plantation"), "plantation").map((entry) =>
              decodeSeat(entry, "plantation seat"),
            ),
      arms: decodeArms(field(object, "arms")),
      resigned: expectArray(field(object, "resigned"), "resigned").map((entry) =>
        decodeSeat(entry, "resigned seat"),
      ),
    };
  },
};
