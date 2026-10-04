import {
  expectArray,
  expectInteger,
  expectObject,
  expectString,
  field,
  gameId,
  seatId,
  type Codec,
  type Frame,
  type FrameIndex,
  type GameDefinition,
  type Json,
  type Random,
  type Roster,
  type SeatId,
} from "../index.ts";

/**
 * A synthetic three-seat game that exercises every shape the primitive supports:
 * a single turn seat, a multi-actor window, a hidden seeded value, and a
 * terminal condition. It imports nothing but the public surface, so it is the
 * proof that a game plugs in with no primitive edits.
 *
 * One round is two frames:
 *   call    owed by the caller only — the caller calls heads or tails
 *   stake   owed by every active seat — each seat may match the call or idle
 *
 * The stake frame resolves the round (the hidden coin is revealed and coins are
 * paid), so the next frame begins the next round's call.
 *
 * `pendingCoin` is the hidden seeded value: it is drawn at genesis and after
 * each resolve, lives in state, and is redacted by `project` until the frame
 * that consumes it. `secret` is a per-seat hidden value that only its owner may
 * see.
 */

export type Side = "heads" | "tails";

export interface CoinflipSetup {
  readonly rounds: number;
}

export interface CoinflipPlayer {
  readonly seat: SeatId;
  readonly coins: number;
  readonly secret: number;
}

export type CoinflipPhase = "call" | "stake" | "over";

export interface CoinflipState {
  readonly players: readonly CoinflipPlayer[];
  readonly round: number;
  readonly maxRounds: number;
  readonly phase: CoinflipPhase;
  readonly caller: SeatId;
  readonly call: Side | null;
  /** Hidden until the stake frame resolves; never present in a view. */
  readonly pendingCoin: Side;
  readonly lastResult: Side | null;
  readonly winner: SeatId | null;
}

export type CoinflipAction = { readonly t: "call"; readonly side: Side } | { readonly t: "stake" };

export interface CoinflipView {
  readonly seat: SeatId;
  readonly players: readonly { readonly seat: SeatId; readonly coins: number }[];
  /** Only the viewer's own secret; every other seat's secret is absent. */
  readonly mySecret: number;
  readonly round: number;
  readonly phase: CoinflipPhase;
  readonly caller: SeatId;
  readonly call: Side | null;
  readonly lastResult: Side | null;
  readonly winner: SeatId | null;
}

const isSide = (value: string): value is Side => value === "heads" || value === "tails";

const drawCoin = (rng: Random): Side => (rng.int(2) === 0 ? "heads" : "tails");

const playerOf = (state: CoinflipState, seat: SeatId): CoinflipPlayer => {
  const player = state.players.find((p) => p.seat === seat);
  if (player === undefined) throw new CoinflipError(`seat ${seat} is not a player`);
  return player;
};

const withPlayer = (state: CoinflipState, next: CoinflipPlayer): CoinflipState => ({
  ...state,
  players: state.players.map((p) => (p.seat === next.seat ? next : p)),
});

const nextCaller = (state: CoinflipState): SeatId => {
  const order = state.players.map((p) => p.seat);
  const position = order.indexOf(state.caller);
  return order[(position + 1) % order.length]!;
};

const winnerOf = (state: CoinflipState): SeatId | null => {
  const ranked = [...state.players].sort((a, b) => b.coins - a.coins);
  const top = ranked[0];
  if (top === undefined) return null;
  return ranked.filter((p) => p.coins === top.coins).length === 1 ? top.seat : null;
};

const anyBroke = (state: CoinflipState): boolean => state.players.some((p) => p.coins <= 0);

const stateCodec: Codec<CoinflipState> = {
  encode: (state): Json => ({
    players: state.players.map((p): Json => ({ seat: p.seat, coins: p.coins, secret: p.secret })),
    round: state.round,
    maxRounds: state.maxRounds,
    phase: state.phase,
    caller: state.caller,
    call: state.call,
    pendingCoin: state.pendingCoin,
    lastResult: state.lastResult,
    winner: state.winner,
  }),
  decode: (json): CoinflipState => {
    const object = expectObject(json, "coinflip state");
    const players = expectArray(field(object, "players"), "players").map(
      (entry): CoinflipPlayer => {
        const player = expectObject(entry, "player");
        return {
          seat: seatId(expectString(field(player, "seat"), "player seat")),
          coins: expectInteger(field(player, "coins"), "player coins"),
          secret: expectInteger(field(player, "secret"), "player secret"),
        };
      },
    );
    const phase = expectString(field(object, "phase"), "phase");
    if (phase !== "call" && phase !== "stake" && phase !== "over") {
      throw new CoinflipError(`unknown phase: ${phase}`);
    }
    const call = nullableSide(field(object, "call"), "call");
    const lastResult = nullableSide(field(object, "lastResult"), "lastResult");
    const pendingCoin = expectString(field(object, "pendingCoin"), "pendingCoin");
    if (!isSide(pendingCoin)) throw new CoinflipError(`unknown coin: ${pendingCoin}`);
    const winner = nullableSeat(field(object, "winner"), "winner");
    return {
      players,
      round: expectInteger(field(object, "round"), "round"),
      maxRounds: expectInteger(field(object, "maxRounds"), "maxRounds"),
      phase,
      caller: seatId(expectString(field(object, "caller"), "caller")),
      call,
      pendingCoin,
      lastResult,
      winner,
    };
  },
};

const nullableSide = (json: Json, what: string): Side | null => {
  if (json === null) return null;
  const value = expectString(json, what);
  if (!isSide(value)) throw new CoinflipError(`${what}: unknown side ${value}`);
  return value;
};

const nullableSeat = (json: Json, what: string): SeatId | null => {
  if (json === null) return null;
  return seatId(expectString(json, what));
};

const actionCodec: Codec<CoinflipAction> = {
  encode: (action): Json =>
    action.t === "call" ? { t: "call", side: action.side } : { t: "stake" },
  decode: (json): CoinflipAction => {
    const object = expectObject(json, "coinflip action");
    const t = expectString(field(object, "t"), "action type");
    if (t === "stake") return { t: "stake" };
    if (t === "call") {
      const side = expectString(field(object, "side"), "call side");
      if (!isSide(side)) throw new CoinflipError(`unknown side: ${side}`);
      return { t: "call", side };
    }
    throw new CoinflipError(`unknown action: ${t}`);
  },
};

export const coinflip: GameDefinition<CoinflipState, CoinflipAction, CoinflipSetup, CoinflipView> =
  {
    id: gameId("coinflip"),
    version: 1,
    state: stateCodec,
    action: actionCodec,

    genesis(setup: CoinflipSetup, roster: Roster, rng: Random): CoinflipState {
      const players = roster.order.map((seat, index): CoinflipPlayer => ({
        seat,
        coins: 3,
        // Distinct high digit per seat keeps the redaction assertion unambiguous.
        secret: (index + 1) * 1_000_000 + rng.int(1_000_000),
      }));
      const caller = roster.order[0];
      if (caller === undefined) throw new CoinflipError("coinflip needs at least one seat");
      return {
        players,
        round: 0,
        maxRounds: setup.rounds,
        phase: "call",
        caller,
        call: null,
        pendingCoin: drawCoin(rng),
        lastResult: null,
        winner: null,
      };
    },

    seatsOwed(state: CoinflipState, _index: FrameIndex): readonly SeatId[] {
      switch (state.phase) {
        case "call":
          return [state.caller];
        case "stake":
          return state.players.map((p) => p.seat);
        case "over":
          return [];
      }
    },

    step(state: CoinflipState, frame: Frame<CoinflipAction>, rng: Random): CoinflipState {
      switch (state.phase) {
        case "call": {
          const input = frame.inputs.find(([seat]) => seat === state.caller)?.[1];
          const call =
            input?.kind === "act" && input.action.t === "call" ? input.action.side : null;
          return { ...state, phase: "stake", call };
        }
        case "stake": {
          const stakers = frame.inputs
            .filter(([, input]) => input.kind === "act" && input.action.t === "stake")
            .map(([seat]) => seat);
          const coin = state.pendingCoin;
          let next = state;
          for (const seat of stakers) {
            const player = playerOf(next, seat);
            const wins = state.call !== null && state.call === coin;
            const coins = Math.max(0, player.coins + (wins ? 1 : -1));
            next = withPlayer(next, { ...player, coins });
          }
          const round = next.round + 1;
          const over = anyBroke(next) || round >= next.maxRounds;
          return {
            ...next,
            round,
            phase: over ? "over" : "call",
            caller: nextCaller(next),
            call: null,
            pendingCoin: drawCoin(rng),
            lastResult: coin,
            winner: over ? winnerOf(next) : null,
          };
        }
        case "over":
          return state;
      }
    },

    project(state: CoinflipState, seat: SeatId): CoinflipView {
      // The redaction boundary: `pendingCoin` and every secret but the viewer's own
      // are dropped here. The raw state never leaves the session.
      return {
        seat,
        players: state.players.map((p) => ({ seat: p.seat, coins: p.coins })),
        mySecret: playerOf(state, seat).secret,
        round: state.round,
        phase: state.phase,
        caller: state.caller,
        call: state.call,
        lastResult: state.lastResult,
        winner: state.winner,
      };
    },

    isTerminal(state: CoinflipState): boolean {
      return state.phase === "over";
    },
  };

export class CoinflipError extends Error {
  override readonly name = "CoinflipError";
}
