import type { SeatId } from "../../index.ts";
import type { ScapeGoatAction } from "./actions.ts";
import { coloursOf, type CardId } from "./cards.ts";
import { LOCATION_LINE } from "./locations.ts";
import { ScapeGoatError } from "./error.ts";
import { activeSeats, colourAt, outcomeOf, seatsOwedNow } from "./reducer.ts";
import {
  MIN_SEATS,
  STASH_SLOTS,
  suspectOf,
  type Destination,
  type FrameRecord,
  type Location,
  type Outcome,
  type Phase,
  type PrepTokensRemaining,
  type ScapeGoatState,
} from "./state.ts";

export interface PlayerView {
  readonly seat: SeatId;
  readonly at: Location;
  /** Hand size is public; the cards are not. */
  readonly handCount: number;
  /** Preparation tokens are held openly, so the Steal menu reads them without a secret. */
  readonly prepTokens: PrepTokensRemaining;
  readonly resigned: boolean;
}

/**
 * The Spy record as it crosses the boundary. The fact of the spy and the target
 * are always public; `hand` is present only to the spy or when the lobby chose
 * `spyReveal: "public"`.
 */
export interface SpyView {
  readonly spy: SeatId;
  readonly target: SeatId;
  readonly hand: readonly CardId[] | null;
}

/** Everything the rules make public once the game ends. */
export interface OutcomeView {
  readonly kind: Outcome["kind"];
  readonly actor: SeatId | null;
  readonly framed: SeatId | null;
  readonly scapegoat: SeatId;
  readonly winners: readonly SeatId[];
  /** Every seat's mat, turned over for scoring. */
  readonly allSuspects: readonly { readonly seat: SeatId; readonly suspect: SeatId }[];
}

/**
 * What one seat may see. `phase` is carried whole: every field in it is public —
 * `active` is whose turn it is, `location` where they moved, `target` the player
 * everyone watched them name. Hidden information — the scapegoat, the other
 * seats' hands, the Stash identities, and a private Spy hand — never crosses here.
 */
export interface ScapeGoatView {
  readonly seat: SeatId;
  readonly phase: Phase;
  readonly players: readonly PlayerView[];
  readonly myHand: readonly CardId[];
  /** The seat this viewer's own mat names. Only this seat's answer, never another's. */
  readonly mySuspect: SeatId;
  readonly faceUp: Readonly<Record<Destination, CardId>>;
  readonly stashCount: number;
  readonly prepareSide: "prepare" | "frame-steal";
  readonly owedSeats: readonly SeatId[];
  readonly spy: SpyView | null;
  readonly frame: FrameRecord | null;
  readonly outcome: OutcomeView | null;
  readonly terminal: boolean;
}

/** Every seat's mat, revealed at scoring: the scapegoat's own mat names the decoy. */
export const allSuspects = (state: ScapeGoatState): readonly { seat: SeatId; suspect: SeatId }[] =>
  state.players.map((player) => ({ seat: player.seat, suspect: suspectOf(state, player.seat) }));

/**
 * The winning seats. Going to the cops always hands the win to the scapegoat,
 * whoever runs; a frame only pays when it names the true scapegoat, otherwise the
 * scapegoat wins. An abandoned table has no winner.
 */
export const winnersOf = (state: ScapeGoatState): readonly SeatId[] => {
  const outcome = outcomeOf(state);
  if (outcome === null || outcome.kind === "abandoned") return [];
  if (outcome.kind === "cops") return [state.scapegoat];
  if (outcome.framed === state.scapegoat) {
    return state.players.filter((player) => player.seat !== state.scapegoat).map((p) => p.seat);
  }
  return [state.scapegoat];
};

const outcomeView = (state: ScapeGoatState, outcome: Outcome): OutcomeView => ({
  kind: outcome.kind,
  actor: outcome.kind === "abandoned" ? null : outcome.actor,
  framed: outcome.kind === "frame" ? outcome.framed : null,
  scapegoat: state.scapegoat,
  winners: winnersOf(state),
  allSuspects: allSuspects(state),
});

/**
 * The redaction boundary. Drops the scapegoat, the decoy, every other seat's hand,
 * the Stash card identities, and a private Spy hand. Emits the viewer's own
 * suspect and, once the game is over, the full scoring record the rules make
 * public.
 */
export const project = (state: ScapeGoatState, seat: SeatId): ScapeGoatView => {
  const mine = state.players.find((player) => player.seat === seat);
  if (mine === undefined) throw new ScapeGoatError(`seat ${seat} is not a player`);
  const terminal = state.phase.kind === "over" || activeSeats(state).length < MIN_SEATS;
  const outcome = outcomeOf(state);
  return {
    seat,
    phase: state.phase,
    players: state.players.map((player): PlayerView => ({
      seat: player.seat,
      at: player.at,
      handCount: player.hand.length,
      prepTokens: player.prepTokens,
      resigned: state.resigned.includes(player.seat),
    })),
    myHand: mine === undefined ? [] : [...mine.hand],
    mySuspect: suspectOf(state, seat),
    faceUp: { ...state.faceUp },
    stashCount: state.stash.length,
    prepareSide: state.prepareTokens === 0 ? "frame-steal" : "prepare",
    owedSeats: [...seatsOwedNow(state)],
    spy:
      state.spy === null
        ? null
        : {
            spy: state.spy.spy,
            target: state.spy.target,
            hand:
              state.spy.reveal === "public" || state.spy.spy === seat ? [...state.spy.hand] : null,
          },
    frame: state.frame,
    outcome: terminal && outcome !== null ? outcomeView(state, outcome) : null,
    terminal,
  };
};

const handIndices = (hand: readonly CardId[], tag: "reveal" | "give" | "put" | "swap"): readonly ScapeGoatAction[] =>
  hand.map((_, index) => ({ t: tag, index }));

const otherActiveSeats = (view: ScapeGoatView): readonly SeatId[] =>
  view.players.filter((p) => !p.resigned && p.seat !== view.seat).map((p) => p.seat);

const atOf = (view: ScapeGoatView, seat: SeatId): Location | null =>
  view.players.find((player) => player.seat === seat)?.at ?? null;

const myPrepTokens = (view: ScapeGoatView): PrepTokensRemaining =>
  view.players.find((player) => player.seat === view.seat)?.prepTokens ?? 0;

const swapMenu = (view: ScapeGoatView): readonly ScapeGoatAction[] => {
  // A view's `players` is the same canonical order the state's is, so the one
  // seat-to-colour derivation in reducer.ts serves both.
  const own = colourAt(view.players.map((player) => player.seat), view.seat);
  const forced = view.myHand
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => coloursOf(card).includes(own))
    .map(({ index }) => index);
  const indices = forced.length > 0 ? forced : view.myHand.map((_, index) => index);
  return indices.map((index): ScapeGoatAction => ({ t: "swap", index }));
};

/**
 * The action menu for the viewer, derived from the redacted view alone. A UI and a
 * test policy both read this instead of encoding rules, and because it reads only
 * a view it cannot leak a secret into a menu.
 */
export const legalActions = (view: ScapeGoatView): readonly ScapeGoatAction[] => {
  const phase = view.phase;
  switch (phase.kind) {
    case "move": {
      if (view.seat === phase.active) {
        const here = atOf(view, view.seat);
        const moves = LOCATION_LINE.filter((destination) => destination !== here).map(
          (to): ScapeGoatAction => ({ t: "move", to }),
        );
        return [...moves, { t: "go-to-cops" }];
      }
      return view.owedSeats.includes(view.seat) ? [{ t: "go-to-cops" }] : [];
    }
    case "action": {
      if (view.seat !== phase.active) return [];
      const face =
        phase.location === "prepare" && view.prepareSide === "frame-steal"
          ? "frame-steal"
          : phase.location;
      switch (face) {
        case "prepare":
          return [{ t: "take-prep-token" }];
        case "spy":
          return otherActiveSeats(view).map((target): ScapeGoatAction => ({ t: "spy", target }));
        case "trade":
          return otherActiveSeats(view).map((target): ScapeGoatAction => ({ t: "trade", target }));
        case "stash":
          return STASH_SLOTS.filter((slot) => slot < view.stashCount).map(
            (slot): ScapeGoatAction => ({ t: "stash", slot }),
          );
        case "frame-steal": {
          if (myPrepTokens(view) > 0) return [{ t: "frame" }];
          // One candidate set with the reducer's stealTarget, so a menu offered to a
          // UI never names a seat the fold would silently redirect or refuse.
          return otherActiveSeats(view)
            .filter((seat) => (view.players.find((player) => player.seat === seat)?.prepTokens ?? 0) > 0)
            .map((seat): ScapeGoatAction => ({ t: "steal", target: seat }));
        }
      }
    }
    case "trade-give": {
      if (view.seat !== phase.active && view.seat !== phase.target) return [];
      return handIndices(view.myHand, "give");
    }
    case "stash-put":
      return view.seat === phase.active ? handIndices(view.myHand, "put") : [];
    case "frame-reveal":
      return view.owedSeats.includes(view.seat) ? handIndices(view.myHand, "reveal") : [];
    case "swap":
      return view.seat === phase.active ? swapMenu(view) : [];
    case "over":
      return [];
  }
};
