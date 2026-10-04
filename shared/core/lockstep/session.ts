import {
  activeSeats,
  buildFrame,
  framePayload,
  isComplete,
  orderSeats,
  type Frame,
  type Roster,
  type SeatInput,
  type SeatReport,
} from "./frame.ts";
import type { GameDefinition } from "./game.ts";
import { chainSeed, makeRandom, stateDigest } from "./hash.ts";
import { frameIndex, type FrameIndex, type SeatId, type Seed } from "./ids.ts";
import {
  advanceFrame,
  appendFrame,
  emptyLog,
  head as logHead,
  type Checkpoint,
  type FrameLog,
} from "./log.ts";
import type { Clock, SessionPort } from "./port.ts";
import { expectedSnapshotSeed, type Snapshot } from "./snapshot.ts";

/** Inbound traffic from a peer. The app decodes its wire format into one of these. */
export type Inbound<A> =
  | { readonly kind: "report"; readonly report: SeatReport<A> }
  | { readonly kind: "frame"; readonly frame: Frame<A> }
  | { readonly kind: "snapshot"; readonly snapshot: Snapshot<A> };

export interface SessionConfig {
  /** Which seat this process plays. */
  readonly seat: SeatId;
  /** How long the local seat may stay silent before `tick` fills `idle` for it. */
  readonly inputTimeoutMs: number;
}

/** Everything the engine needs regardless of how it starts. */
export interface SessionDeps<S, A, Setup, View> {
  readonly game: GameDefinition<S, A, Setup, View>;
  readonly port: SessionPort<A>;
  readonly clock: Clock;
  readonly config: SessionConfig;
}

/** The agreed lobby inputs. Identical on every peer; the base of the induction. */
export interface GenesisInput<Setup> {
  readonly seed: Seed;
  readonly roster: Roster;
  readonly setup: Setup;
}

/**
 * One peer's handle on the game. `report` offers the local seat's intent,
 * `receive` folds inbound traffic, and `view` reads a redacted projection. The
 * raw state is never exposed — the only read path is `game.project(state, seat)`
 * — so the session is not parameterized by the state type at all.
 *
 * `receive` is total for frames: a frame that fails verification (bad seed
 * chain, wrong inputs, too far ahead) is dropped, never thrown, so a peer cannot
 * crash the caller. A *divergent* snapshot (same frame, different seed) is a
 * hard fork and is raised as a `SessionError`; a merely stale snapshot is
 * dropped. See the state-convergence check in `#expectedSeed`.
 */
export interface Session<A, View> {
  readonly seat: SeatId;
  /** Index of the frame currently open (not yet sealed). */
  readonly frame: FrameIndex;
  readonly terminal: boolean;

  /** Offer the local seat's input for the open frame. Ignored if not owed. */
  report(input: SeatInput<A>): void;
  /** Fold an inbound report, frame, or snapshot. */
  receive(message: Inbound<A>): void;
  /** Seats the game expects in the open frame, in canonical order. */
  owed(): readonly SeatId[];
  /** Redacted view for the local seat. */
  view(): View;
  snapshot(): Snapshot<A>;
  /** App-driven timeout check. Reads time only through the injected `Clock`. */
  tick(): void;
}

export class SessionError extends Error {
  override readonly name = "SessionError";
}

/**
 * How far ahead of the open frame a buffered frame may be before it is dropped.
 * The pending buffer is bounded so a peer cannot grow it without limit; anything
 * further ahead is a transport reordering the caller must handle, not a frame
 * worth holding.
 */
export const MAX_PENDING_AHEAD = 8;

/**
 * Construct a session at frame 0 from agreed lobby inputs. Every peer built from
 * the same `GenesisInput` folds to the same genesis state.
 */
export const createSession = <S, A, Setup, View>(
  deps: SessionDeps<S, A, Setup, View>,
  genesis: GenesisInput<Setup>,
): Session<A, View> =>
  new SessionEngine(deps, {
    state: deps.game.genesis(genesis.setup, genesis.roster, makeRandom(genesis.seed)),
    roster: genesis.roster,
    frame: frameIndex(0),
    seed: genesis.seed,
    log: emptyLog(deps.game.id, frameIndex(0)),
  });

/**
 * Load a session from a snapshot instead of genesis. The snapshot's
 * `frame`/`seed`/`roster`/`state` become the base, so a late joiner is current in
 * O(1) with no replay. The result is identical to a session that folded the whole
 * log to the same frame.
 *
 * The stored `seed` is never trusted blindly: it is re-derived from `head` over
 * the carried state and the two must agree, so a tampered snapshot is rejected
 * rather than adopted.
 */
export const resumeSession = <S, A, Setup, View>(
  deps: SessionDeps<S, A, Setup, View>,
  snapshot: Snapshot<A>,
): Session<A, View> => {
  if (snapshot.gameId !== deps.game.id) {
    throw new SessionError(`snapshot is for game ${snapshot.gameId}, not ${deps.game.id}`);
  }
  if (snapshot.version !== deps.game.version) {
    throw new SessionError(
      `snapshot is version ${String(snapshot.version)}, expected ${String(deps.game.version)}`,
    );
  }
  return new SessionEngine(deps, {
    state: deps.game.state.decode(snapshot.state),
    roster: snapshot.roster,
    frame: snapshot.frame,
    seed: baseSeed(deps.game, snapshot),
    log: logFromSnapshot(snapshot),
  });
};

/**
 * The seed the snapshot's open frame is stepped with, derived from its head over
 * the state it carries. At genesis there is no head, so the agreed seed is it,
 * but a headless snapshot must be frame 0.
 */
const baseSeed = <S, A, Setup, View>(
  game: GameDefinition<S, A, Setup, View>,
  snapshot: Snapshot<A>,
): Seed => {
  if (snapshot.head === null) {
    if (snapshot.frame !== 0) {
      throw new SessionError(
        `snapshot has no head but frame ${String(snapshot.frame)}; a headless snapshot must be frame 0`,
      );
    }
    return snapshot.seed;
  }
  const expected = expectedSnapshotSeed(game, snapshot.head, game.state.decode(snapshot.state));
  if (snapshot.seed !== expected) {
    throw new SessionError("snapshot seed does not chain from its head over the carried state");
  }
  return expected;
};

/**
 * Rebuild the local log from a snapshot. `base` is the index of `frames[0]`, so
 * it is the head's index when a head exists and `frame` at genesis.
 */
const logFromSnapshot = <A>(snapshot: Snapshot<A>): FrameLog<A> => ({
  gameId: snapshot.gameId,
  base: snapshot.head === null ? snapshot.frame : snapshot.head.index,
  frames: snapshot.head === null ? [] : [snapshot.head],
});

interface Base<S, A> {
  readonly state: S;
  readonly roster: Roster;
  readonly frame: FrameIndex;
  readonly seed: Seed;
  readonly log: FrameLog<A>;
}

class SessionEngine<S, A, Setup, View> implements Session<A, View> {
  readonly seat: SeatId;

  #game: GameDefinition<S, A, Setup, View>;
  #port: SessionPort<A>;
  #clock: Clock;
  #timeoutMs: number;

  #state: S;
  #roster: Roster;
  #frame: FrameIndex;
  #seed: Seed;
  #log: FrameLog<A>;
  #buffer = new Map<SeatId, SeatInput<A>>();
  #pending = new Map<number, Frame<A>>();
  #openedAt: number;

  constructor(deps: SessionDeps<S, A, Setup, View>, base: Base<S, A>) {
    this.seat = deps.config.seat;
    this.#game = deps.game;
    this.#port = deps.port;
    this.#clock = deps.clock;
    this.#timeoutMs = deps.config.inputTimeoutMs;
    this.#state = base.state;
    this.#roster = base.roster;
    this.#frame = base.frame;
    this.#seed = base.seed;
    this.#log = base.log;
    this.#openedAt = deps.clock.now();
  }

  get frame(): FrameIndex {
    return this.#frame;
  }

  get terminal(): boolean {
    return this.#game.isTerminal(this.#state);
  }

  /**
   * Seats owed in the open frame, in canonical order. An empty owed set on a
   * non-terminal state is a game contract violation: `isComplete` would be
   * vacuously true and the session would seal empty frames forever, spinning the
   * frame index with no progress. Fail loudly instead.
   */
  owed(): readonly SeatId[] {
    const active = activeSeats(this.#roster);
    const owedByGame = this.#game.seatsOwed(this.#state, this.#frame);
    const owed = orderSeats(
      this.#roster,
      owedByGame.filter((seat) => active.includes(seat)),
    );
    if (owed.length === 0 && !this.terminal) {
      throw new SessionError(
        `game ${this.#game.id} owes no seats in frame ${String(this.#frame)} but is not terminal; seatsOwed must not return an empty set while isTerminal is false`,
      );
    }
    return owed;
  }

  report(input: SeatInput<A>): void {
    if (this.terminal) return;
    if (!this.owed().includes(this.seat)) return;
    if (this.#buffer.has(this.seat)) return;
    this.#buffer.set(this.seat, input);
    this.#port.sendReport({ frame: this.#frame, seat: this.seat, input });
    this.#sealIfComplete();
  }

  receive(message: Inbound<A>): void {
    if (this.terminal) return;
    switch (message.kind) {
      case "report":
        this.#receiveReport(message.report);
        return;
      case "frame":
        this.#receiveFrame(message.frame);
        return;
      case "snapshot":
        this.#adoptSnapshot(message.snapshot);
        return;
    }
  }

  view(): View {
    return this.#game.project(this.#state, this.seat);
  }

  snapshot(): Snapshot<A> {
    return {
      gameId: this.#log.gameId,
      version: this.#game.version,
      frame: this.#frame,
      seed: this.#seed,
      roster: this.#roster,
      state: this.#game.state.encode(this.#state),
      head: logHead(this.#log),
    };
  }

  tick(): void {
    if (this.terminal) return;
    if (this.owed().includes(this.seat) && !this.#buffer.has(this.seat)) {
      if (this.#clock.now() - this.#openedAt >= this.#timeoutMs) this.report({ kind: "idle" });
    }
    this.#sealIfComplete();
  }

  #receiveReport(report: SeatReport<A>): void {
    if (report.frame !== this.#frame) return;
    if (!this.owed().includes(report.seat)) return;
    if (this.#buffer.has(report.seat)) return;
    this.#buffer.set(report.seat, report.input);
    this.#sealIfComplete();
  }

  /**
   * Fold an inbound frame. A frame at the head is verified synchronously; a
   * frame ahead is buffered (bounded) and verified when the gap closes. Either
   * way a frame that fails verification is dropped, not thrown: a peer's bad
   * frame must never crash the caller's `receive`.
   */
  #receiveFrame(frame: Frame<A>): void {
    if (frame.index < this.#frame) return;
    if (frame.index > this.#frame) {
      if (frame.index - this.#frame > MAX_PENDING_AHEAD) return;
      this.#pending.set(frame.index, frame);
      return;
    }
    this.#tryAdopt(frame);
    this.#drainPending();
  }

  /**
   * Verify and apply a fully-agreed inbound frame. The frame must carry the seed
   * that chains from our local head, and its inputs must be exactly the owed set,
   * so a forged frame is rejected at the boundary rather than folded. Returns
   * without committing if the frame fails verification.
   */
  #tryAdopt(frame: Frame<A>): void {
    if (frame.seed !== this.#expectedSeed()) return;
    const owed = this.owed();
    if (
      !sameSeatSet(
        owed,
        frame.inputs.map(([seat]) => seat),
      )
    ) {
      return;
    }
    // Rebuild from the canonical owed set so a peer's input order cannot leak
    // into our fold; then commit without rebroadcasting.
    this.#commit(buildFrame(this.#roster, owed, this.#frame, this.#seed, new Map(frame.inputs)));
  }

  /**
   * Adopt an inbound snapshot. A stale snapshot is dropped; a snapshot at the
   * same frame but with a different seed is a divergence and is rejected loudly;
   * a forward snapshot is adopted after its seed chain is verified over the state
   * it carries. The stored seed is always re-derived from the head.
   */
  #adoptSnapshot(snapshot: Snapshot<A>): void {
    if (snapshot.gameId !== this.#game.id || snapshot.version !== this.#game.version) {
      throw new SessionError("inbound snapshot is for an incompatible game");
    }
    if (snapshot.frame < this.#frame) return;
    if (snapshot.frame === this.#frame && snapshot.seed !== this.#seed) {
      throw new SessionError(
        `divergent snapshot: frame ${String(snapshot.frame)} carries a different seed than the local head`,
      );
    }
    const seed = baseSeed(this.#game, snapshot);
    this.#state = this.#game.state.decode(snapshot.state);
    this.#roster = snapshot.roster;
    this.#frame = snapshot.frame;
    this.#seed = seed;
    this.#log = logFromSnapshot(snapshot);
    this.#buffer.clear();
    this.#pending.clear();
    this.#openedAt = this.#clock.now();
  }

  /**
   * The seed frame `#frame` must be stepped with, recomputed from the local head
   * over the current state (the state after the head). This is the
   * state-convergence check: a peer that folded the same inputs but reached a
   * different state computes a different value here, so its next frame no longer
   * chains and is rejected instead of silently forking. At genesis there is no
   * head, so the agreed genesis seed is it.
   */
  #expectedSeed(): Seed {
    const head = logHead(this.#log);
    if (head === null) return this.#seed;
    return chainSeed(
      head.seed,
      head.index,
      framePayload(head, this.#game.action),
      stateDigest(this.#game.state.encode(this.#state)),
    );
  }

  #sealIfComplete(): void {
    if (this.terminal) return;
    const owed = this.owed();
    if (!isComplete(owed, this.#buffer)) return;
    const frame = buildFrame(this.#roster, owed, this.#frame, this.#seed, this.#buffer);
    this.#commit(frame);
    this.#port.send(frame);
    this.#drainPending();
  }

  /** Fold one agreed frame and advance the head. The single mutation point. */
  #commit(frame: Frame<A>): void {
    const next = advanceFrame(this.#game, this.#checkpoint(), frame);
    this.#state = next.state;
    this.#roster = next.roster;
    this.#seed = next.seed;
    this.#frame = next.frame;
    this.#log = appendFrame(this.#log, frame);
    this.#buffer.clear();
    this.#openedAt = this.#clock.now();
  }

  #checkpoint(): Checkpoint<S> {
    return { state: this.#state, roster: this.#roster, frame: this.#frame, seed: this.#seed };
  }

  /**
   * Apply buffered frames whose gap has closed. A buffered frame that fails
   * verification is dropped and draining continues, so a forged frame buffered
   * ahead cannot throw out of an unrelated `receive`.
   */
  #drainPending(): void {
    for (
      let next = this.#pending.get(this.#frame);
      next !== undefined;
      next = this.#pending.get(this.#frame)
    ) {
      this.#pending.delete(this.#frame);
      this.#tryAdopt(next);
    }
  }
}

const sameSeatSet = (a: readonly SeatId[], b: readonly SeatId[]): boolean =>
  a.length === b.length && a.every((seat) => b.includes(seat));
