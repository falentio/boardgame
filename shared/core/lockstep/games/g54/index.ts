import {
  gameId,
  type Frame,
  type FrameIndex,
  type GameDefinition,
  type Random,
  type Roster,
  type SeatId,
} from "../../index.ts";
import { actionCodec, type G54Action } from "./actions.ts";
import { G54Error } from "./error.ts";
import { generalActionsFor, type GeneralActionId } from "./generals.ts";
import { type RoleId } from "./roles.ts";
import { genesisState, type G54Setup } from "./setup.ts";
import {
  stateCodec,
  type ArmsReveal,
  type BombState,
  type DisappearToken,
  type G54State,
  type PendingAction,
  type TaxMark,
  type Window,
} from "./state.ts";
import { isTerminal, seatsOwedFor, stepState, winnerOf } from "./windows.ts";

export { G54Error } from "./error.ts";
export type { G54Action } from "./actions.ts";
export type { G54Setup } from "./setup.ts";
export type { G54State, G54Player, ExtraClaim, LossCause } from "./state.ts";
export type { GeneralActionId } from "./generals.ts";
export { ROLE_CATALOG, STARTER_ROLES, type RoleId, type RoleSpec } from "./roles.ts";

/** The pending claim/target as it appears in a redacted view. */
export interface PendingView {
  readonly claimant: SeatId;
  readonly role: RoleId | null;
  readonly target: SeatId | null;
  readonly blocker: SeatId | null;
  readonly named: RoleId | null;
}

export interface WindowView {
  readonly kind: Window["kind"];
  readonly purpose: Window["purpose"];
}

export interface PlayerView {
  readonly seat: SeatId;
  readonly coins: number;
  readonly handCount: number;
  readonly revealed: readonly RoleId[];
}

export interface TokenView {
  readonly peacekeeping: SeatId | null;
  readonly treaty: readonly SeatId[];
  readonly tax: TaxMark | null;
  readonly disappear: readonly DisappearToken[];
  readonly bomb: BombState | null;
}

/**
 * What one seat may see. Hidden information — the Court order and every other
 * seat's face-down hand — never crosses this boundary. Public information is the
 * active roles, coins, revealed cards, hand counts, the Court and Treasury sizes,
 * token holders, the turn, and the pending claim/target.
 */
export interface G54View {
  readonly seat: SeatId;
  readonly roles: readonly RoleId[];
  readonly players: readonly PlayerView[];
  readonly myHand: readonly RoleId[];
  /** The Court cards drawn for a swap in progress, visible only to the actor. */
  readonly myDraw: readonly RoleId[] | null;
  /** The cards collected by a Socialist sub-turn, visible only to the actor. */
  readonly mySocialist: readonly RoleId[] | null;
  readonly courtCount: number;
  readonly treasury: number;
  readonly bank: number;
  readonly active: SeatId;
  readonly turn: number;
  readonly window: WindowView | null;
  readonly pending: PendingView | null;
  readonly tokens: TokenView;
  /** The general actions this seat may report from, in menu order. */
  readonly generalActions: readonly GeneralActionId[];
  readonly socialMedia: boolean;
  /** The last Arms Dealer reveal, public and view-only. */
  readonly arms: ArmsReveal | null;
  readonly winner: SeatId | null;
  readonly terminal: boolean;
}

const pendingView = (pending: PendingAction | null): PendingView | null =>
  pending === null
    ? null
    : {
        claimant: pending.claimant,
        role: pending.role,
        target: pending.target,
        blocker: pending.blocker,
        named: pending.named,
      };

export const g54: GameDefinition<G54State, G54Action, G54Setup, G54View> = {
  id: gameId("g54"),
  version: 4,
  state: stateCodec,
  action: actionCodec,

  genesis(setup: G54Setup, roster: Roster, rng: Random): G54State {
    const state = genesisState(setup, roster, rng);
    // The stack opens with the first seat's turn window so `seatsOwed` is never
    // empty on a non-terminal state.
    return {
      ...state,
      steps: [
        {
          kind: "window",
          window: { kind: "turn", purpose: "turn", seats: [state.active], cause: null },
        },
      ],
    };
  },

  seatsOwed(state: G54State, index: FrameIndex): readonly SeatId[] {
    return seatsOwedFor(state, index);
  },

  step(state: G54State, frame: Frame<G54Action>, rng: Random): G54State {
    return stepState(state, frame, rng);
  },

  project(state: G54State, seat: SeatId): G54View {
    if (!state.players.some((p) => p.seat === seat)) {
      throw new G54Error(`seat ${seat} is not a player`);
    }
    const mine = state.players.find((p) => p.seat === seat);
    const top = state.steps[0];
    const window =
      top !== undefined && top.kind === "window"
        ? { kind: top.window.kind, purpose: top.window.purpose }
        : null;
    return {
      seat,
      roles: [...state.roles],
      players: state.players.map((p): PlayerView => ({
        seat: p.seat,
        coins: p.coins,
        handCount: p.hand.length,
        revealed: [...p.revealed],
      })),
      myHand: mine === undefined ? [] : [...mine.hand],
      myDraw: state.draw !== null && state.draw.seat === seat ? [...state.draw.pool] : null,
      mySocialist:
        state.socialist !== null && state.socialist.seat === seat
          ? [...state.socialist.pool]
          : null,
      courtCount: state.court.length,
      treasury: state.treasury,
      bank: state.bank,
      active: state.active,
      turn: state.turn,
      window,
      pending: pendingView(state.pending),
      tokens: {
        peacekeeping: state.peacekeeping,
        treaty: [...state.treaty],
        tax: state.tax === null ? null : { role: state.tax.role, holder: state.tax.holder },
        disappear: state.disappear.map((token): DisappearToken => ({ ...token })),
        bomb: state.bomb === null ? null : { ...state.bomb, prior: [...state.bomb.prior] },
      },
      generalActions: generalActionsFor(state),
      socialMedia: state.socialMedia,
      arms: state.arms === null ? null : { ...state.arms, cards: [...state.arms.cards] },
      winner: winnerOf(state),
      terminal: isTerminal(state),
    };
  },

  isTerminal(state: G54State): boolean {
    return isTerminal(state);
  },
};
