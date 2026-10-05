import type { Random, SeatId } from "../../index.ts";
import { G54Error } from "./error.ts";
import type { RoleId } from "./roles.ts";
import {
  windowKindFor,
  type BombState,
  type ExtraClaim,
  type G54Player,
  type G54State,
  type LossCause,
  type PendingAction,
  type Step,
  type Window,
  type WindowPurpose,
} from "./state.ts";

export const playerOf = (state: G54State, seat: SeatId): G54Player => {
  const player = state.players.find((p) => p.seat === seat);
  if (player === undefined) throw new G54Error(`seat ${seat} is not a player`);
  return player;
};

export const withPlayer = (state: G54State, next: G54Player): G54State => ({
  ...state,
  players: state.players.map((p) => (p.seat === next.seat ? next : p)),
});

export const isAlive = (player: G54Player): boolean => player.hand.length > 0;

export const isResigned = (state: G54State, seat: SeatId): boolean => state.resigned.includes(seat);

/**
 * A seat is in play when it holds face-down influence. A Producer exchange
 * transiently leaves its partner with zero cards before returning one, and a
 * Socialist card-giver is cardless between giving and the redistribution, so
 * both stay in play until their sub-turn closes.
 */
export const isInPlay = (state: G54State, player: G54Player): boolean =>
  isAlive(player) ||
  state.draw?.target === player.seat ||
  (state.socialist?.givers.includes(player.seat) ?? false);

export const aliveSeats = (state: G54State): readonly SeatId[] =>
  state.players.filter((p) => isInPlay(state, p) && !isResigned(state, p.seat)).map((p) => p.seat);

export const aliveCount = (state: G54State): number => aliveSeats(state).length;

export const isTerminal = (state: G54State): boolean => aliveCount(state) <= 1;

export const winnerOf = (state: G54State): SeatId | null => {
  const alive = aliveSeats(state);
  return alive.length === 1 ? (alive[0] ?? null) : null;
};

export const otherAlive = (state: G54State, seat: SeatId): readonly SeatId[] =>
  aliveSeats(state).filter((s) => s !== seat);

/** Seats in clockwise order starting one step past `anchor`, restricted to `seats`. */
export const clockwise = (
  state: G54State,
  anchor: SeatId,
  seats: readonly SeatId[],
): readonly SeatId[] => {
  const order = state.players.map((p) => p.seat);
  const n = order.length;
  const from = order.indexOf(anchor);
  if (from < 0) return [...seats];
  const rank = new Map<SeatId, number>();
  for (const seat of seats) {
    const at = order.indexOf(seat);
    if (at >= 0) rank.set(seat, (at - from + n) % n);
  }
  return [...seats].sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
};

export const nextAlive = (state: G54State, anchor: SeatId): SeatId => {
  const rotated = clockwise(state, anchor, aliveSeats(state)).filter((seat) => seat !== anchor);
  return rotated[0] ?? anchor;
};

export const isAlly = (state: G54State, a: SeatId, b: SeatId): boolean =>
  state.treaty.length === 2 && state.treaty.includes(a) && state.treaty.includes(b);

/** A seat another seat may name for a targeted action, per the token rules. */
export const targetable = (state: G54State, claimant: SeatId, seat: SeatId): boolean =>
  seat !== claimant &&
  isAlive(playerOf(state, seat)) &&
  state.peacekeeping !== seat &&
  !isAlly(state, claimant, seat);

/** Coup bypasses Peacekeeping but not a treaty, per `08-tokens-and-special-cases.md`. */
export const coupTargetable = (state: G54State, claimant: SeatId, seat: SeatId): boolean =>
  seat !== claimant && isAlive(playerOf(state, seat)) && !isAlly(state, claimant, seat);

/**
 * A legal next Bomb holder: alive, not resigned, and not the current holder or
 * any prior holder (the prior set includes the active player, who can never be
 * re-named).
 */
export const bombPassable = (state: G54State, bomb: BombState, target: SeatId): boolean =>
  target !== bomb.holder &&
  !bomb.prior.includes(target) &&
  isAlive(playerOf(state, target)) &&
  !isResigned(state, target);

/** Priest has no target selection, so it reaches allies but still spares the Peacekeeper. */
export const priestTargetable = (state: G54State, claimant: SeatId, seat: SeatId): boolean =>
  seat !== claimant && isAlive(playerOf(state, seat)) && state.peacekeeping !== seat;

/** Move up to `amount` coins from `from` to `to`; partial when the source is short. */
export const transferCoins = (
  state: G54State,
  from: SeatId,
  to: SeatId,
  amount: number,
): G54State => {
  const source = playerOf(state, from);
  const taken = Math.max(0, Math.min(amount, source.coins));
  const next = withPlayer(state, { ...source, coins: source.coins - taken });
  return withPlayer(next, { ...playerOf(next, to), coins: playerOf(next, to).coins + taken });
};

export const gainFromTreasury = (state: G54State, seat: SeatId, amount: number): G54State => {
  const player = playerOf(state, seat);
  const taken = Math.max(0, Math.min(amount, state.treasury));
  return {
    ...withPlayer(state, { ...player, coins: player.coins + taken }),
    treasury: state.treasury - taken,
  };
};

export const payToTreasury = (state: G54State, seat: SeatId, amount: number): G54State => {
  const player = playerOf(state, seat);
  const paid = Math.max(0, Math.min(amount, player.coins));
  return {
    ...withPlayer(state, { ...player, coins: player.coins - paid }),
    treasury: state.treasury + paid,
  };
};

export const courtDraw = (
  state: G54State,
  count: number,
): { readonly drawn: readonly RoleId[]; readonly court: readonly RoleId[] } => {
  const n = Math.max(0, Math.min(count, state.court.length));
  return { drawn: state.court.slice(0, n), court: state.court.slice(n) };
};

/** A plain Court swap: draw `count`, keep the hand size, return the rest. */
export const openSwap = (state: G54State, seat: SeatId, count: number): G54State => {
  const { drawn, court } = courtDraw(state, count);
  return {
    ...state,
    court,
    draw: { seat, pool: [...drawn], keepSize: playerOf(state, seat).hand.length, target: null },
  };
};

/** Take 1 coin from the Treasury and add it to the public Bank pile (partial when short). */
export const bankDeposit = (state: G54State): G54State => {
  const moved = Math.min(1, state.treasury);
  return { ...state, treasury: state.treasury - moved, bank: state.bank + moved };
};

export const returnToCourt = (
  state: G54State,
  cards: readonly RoleId[],
  rng: Random,
): readonly RoleId[] => rng.shuffle([...state.court, ...cards]);

/**
 * Show one matching card as proof: remove it from the hand, shuffle it into the
 * Court, and draw a hidden replacement, so the hand size and deck stay conserved
 * and the replacement's identity is not revealed.
 */
export const proveCard = (state: G54State, seat: SeatId, role: RoleId, rng: Random): G54State => {
  const player = playerOf(state, seat);
  const index = player.hand.indexOf(role);
  if (index < 0) return state;
  const hand = player.hand.filter((_, i) => i !== index);
  const court = rng.shuffle([...state.court, role]);
  const replacement = court[0];
  return withPlayer(
    { ...state, court: court.slice(1) },
    { ...player, hand: replacement === undefined ? hand : [...hand, replacement] },
  );
};

/** Draw `count` Court cards directly into a seat's hand, partial when the Court is short. */
export const drawIntoHand = (state: G54State, seat: SeatId, count: number): G54State => {
  const { drawn, court } = courtDraw(state, count);
  const player = playerOf(state, seat);
  return withPlayer({ ...state, court }, { ...player, hand: [...player.hand, ...drawn] });
};

/** Clear the treaty once only two players remain, per `08-tokens-and-special-cases.md`. */
export const expireTreaty = (state: G54State): G54State =>
  state.treaty.length > 0 && aliveCount(state) <= 2 ? { ...state, treaty: [] } : state;

/** Drop an eliminated seat's tokens; the Disappear token is discarded, not moved. */
export const clearTokensFor = (state: G54State, seat: SeatId): G54State => ({
  ...state,
  peacekeeping: state.peacekeeping === seat ? null : state.peacekeeping,
  treaty: state.treaty.includes(seat) ? [] : state.treaty,
  disappear: state.disappear.filter((token) => token.target !== seat),
  tax: state.tax !== null && state.tax.holder === seat ? null : state.tax,
  bomb: state.bomb !== null && state.bomb.holder === seat ? null : state.bomb,
});

/** Return an eliminated seat's coins to the Treasury and drop its tokens. */
export const settleNow = (state: G54State, seat: SeatId): G54State => {
  const player = playerOf(state, seat);
  const cleared = clearTokensFor(state, seat);
  return {
    ...withPlayer(cleared, { ...player, coins: 0 }),
    treasury: cleared.treasury + player.coins,
  };
};

export const makeWindow = (
  purpose: WindowPurpose,
  seats: readonly SeatId[],
  cause: LossCause | null = null,
): Window => ({ kind: windowKindFor(purpose), purpose, seats, cause });

export const windowStep = (window: Window): Step => ({ kind: "window", window });
export const revealStep = (seat: SeatId, cause: LossCause): Step =>
  windowStep(makeWindow("reveal", [seat], cause));
export const beginStep = (extra: ExtraClaim): Step => ({ kind: "begin", extra });
export const RESOLVE: Step = { kind: "resolve" };
export const END_TURN: Step = { kind: "end-turn" };

export const withSteps = (state: G54State, steps: readonly Step[]): G54State => ({
  ...state,
  steps,
});

/** The claim currently being resolved: the top linked extra if any, else the main claim. */
export const activeClaim = (state: G54State): PendingAction | ExtraClaim | null => {
  const top = state.extras[state.extras.length - 1];
  if (top !== undefined) return top;
  return state.pending;
};

/** True when a linked extra claim is active. */
export const hasExtra = (state: G54State): boolean => state.extras.length > 0;

/** The seats a window actually owes: every live seat for `any`, else its named seats. */
export const windowPool = (state: G54State, window: Window): readonly SeatId[] =>
  window.kind === "any" ? aliveSeats(state) : window.seats;

export interface ClaimPatch {
  readonly blocker?: SeatId | null;
  readonly challenger?: SeatId | null;
  readonly blockChallenger?: SeatId | null;
}

/** Patch the active claim (the top extra if present, else the main claim). */
export const patchClaim = (state: G54State, patch: ClaimPatch): G54State => {
  const last = state.extras.length - 1;
  if (last >= 0) {
    return {
      ...state,
      extras: state.extras.map((entry, i) => (i === last ? { ...entry, ...patch } : entry)),
    };
  }
  if (state.pending === null) return state;
  return { ...state, pending: { ...state.pending, ...patch } };
};

/** Push a linked extra claim; the top of the stack becomes the active claim. */
export const pushExtra = (state: G54State, extra: ExtraClaim): G54State => ({
  ...state,
  extras: [...state.extras, extra],
});

/** Drop the active claim after it resolves or fails. */
export const popClaim = (state: G54State): G54State =>
  state.extras.length > 0
    ? { ...state, extras: state.extras.slice(0, -1) }
    : { ...state, pending: null };

/** Seats in clockwise order whose coin count is the minimum among `seats`. */
export const poorest = (
  state: G54State,
  anchor: SeatId,
  seats: readonly SeatId[],
): SeatId | null => {
  let best: SeatId | null = null;
  let bestCoins = Number.POSITIVE_INFINITY;
  for (const seat of clockwise(state, anchor, seats)) {
    const coins = playerOf(state, seat).coins;
    if (coins < bestCoins) {
      best = seat;
      bestCoins = coins;
    }
  }
  return best;
};

/** The eligible seat with the most coins, clockwise-first on a tie. */
export const wealthiest = (
  state: G54State,
  anchor: SeatId,
  seats: readonly SeatId[],
): SeatId | null => {
  let best: SeatId | null = null;
  let bestCoins = -1;
  for (const seat of clockwise(state, anchor, seats)) {
    const coins = playerOf(state, seat).coins;
    if (coins > bestCoins) {
      best = seat;
      bestCoins = coins;
    }
  }
  return best;
};
