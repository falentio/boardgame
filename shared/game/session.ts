import {
  createSession,
  resumeSession,
  type Clock,
  type GameDefinition,
  type GenesisInput,
  type SeatId,
  type Session,
  type SessionDeps,
  type SessionPort,
  type Snapshot,
  MAX_PENDING_AHEAD,
} from "../core/lockstep/index.ts";
import { encodeEnvelope, type GameEnvelope } from "./events.ts";
import { decodeMessage, encodeMessage } from "./protocol.ts";

export interface GameChannelHandlers {
  readonly onMessage: (data: unknown) => void;
  readonly onConnected: () => void;
}

export interface GameChannel {
  subscribe(handlers: GameChannelHandlers): () => void;
  publish(envelope: GameEnvelope): void;
}

export interface OpenGameSessionDeps<S, A, Setup, View> {
  readonly game: GameDefinition<S, A, Setup, View>;
  readonly channel: GameChannel;
  readonly seat: SeatId;
  readonly genesis: GenesisInput<Setup>;
  readonly clock?: Clock;
  readonly inputTimeoutMs?: number;
  readonly onChange?: () => void;
}

/**
 * This client's standing against the table. `resyncing` is what a tab that fell
 * behind enters and leaves on its own: it publishes a sync, the room answers with
 * a checkpoint, and the local session is rebuilt from it in the background. It is
 * a loading state, never a verdict and never an instruction to reload.
 *
 * Two independent conditions put a client here, and neither is a judgement about
 * the room: its process was not running across a frame budget, or it fell too far
 * behind for the session's own pending buffer to bridge the gap.
 */
export type SyncState = "live" | "resyncing";

export interface GameSession<A, View> {
  /** The live session. A resync replaces the object, so read it rather than hold it. */
  readonly session: Session<A, View>;
  /** This client's standing against the table. Read it from the app's tick loop. */
  readonly sync: SyncState;
  /** The app's deadline check: the primitive's tick plus this client's resync policy. */
  tick(): void;
  close(): void;
}

export const openGameSession = <S, A, Setup, View>(
  deps: OpenGameSessionDeps<S, A, Setup, View>,
): GameSession<A, View> => {
  const port: SessionPort<A> = {
    sendReport: (report): void => deps.channel.publish(encodeMessage(deps.game, { kind: "report", report })),
    send: (frame): void => deps.channel.publish(encodeMessage(deps.game, { kind: "frame", frame })),
    sendSnapshot: (snapshot): void =>
      deps.channel.publish(encodeMessage(deps.game, { kind: "snapshot", snapshot })),
  };

  // One construction, so the initial build and every rebuild after a resync
  // share the clock, the port, and the budget the session is configured with.
  const sessionDeps: SessionDeps<S, A, Setup, View> = {
    game: deps.game,
    port,
    clock: deps.clock ?? { now: () => Date.now() },
    config: { seat: deps.seat, inputTimeoutMs: deps.inputTimeoutMs ?? 30000 },
  };

  let session = createSession<S, A, Setup, View>(sessionDeps, deps.genesis);
  let askedForCheckpoint = false;
  /** The highest frame index this client has seen on the wire. */
  let frontier = -1;

  /**
   * True when the session can no longer bridge the gap with frames alone. The
   * pending buffer is bounded, so a frame further past our head than that bound is
   * dropped rather than held: reaching it means the frames that would close the gap
   * have already gone by. The bound is the primitive's own, not a tunable here.
   */
  const stranded = (): boolean => frontier > session.frame + MAX_PENDING_AHEAD;

  /** This client's standing against the table. One derivation, read twice. */
  const outOfStep = (): boolean => session.paused || stranded();

  /** Ask the room for its checkpoint. Once per gap, so the request cannot storm. */
  const requestCheckpoint = (): void => {
    if (askedForCheckpoint) return;
    askedForCheckpoint = true;
    deps.channel.publish(encodeEnvelope({ kind: "sync" }));
  };

  /**
   * Abandon the local head and rebuild from a peer's checkpoint. This is why a
   * resync can repair a head that `receive` would reject as divergent:
   * `resumeSession` re-derives the seed from the snapshot's own head over its
   * own carried state and never compares it against the head being discarded.
   */
  const swap = (snapshot: Snapshot<A>): void => {
    if (snapshot.frame < session.frame) return;
    session = resumeSession<S, A, Setup, View>(sessionDeps, snapshot);
    askedForCheckpoint = false;
  };

  const teardown = deps.channel.subscribe({
    onConnected: requestCheckpoint,
    onMessage: (data): void => {
      const message = decodeMessage(deps.game, data);
      if (message === null) return;
      if (message.kind === "sync") {
        // Answering costs nothing: our own head is untouched, so a peer that is
        // behind never drags the room into a resync.
        if (session.frame > 0) port.sendSnapshot(session.snapshot());
        return;
      }
      if (message.kind === "frame" && message.frame.index > frontier) {
        frontier = message.frame.index;
      }

      try {
        // A snapshot that folds here is the cheapest repair, so try it first and
        // abandon our head only when we cannot fold it or we outran our pending
        // buffer waiting for frames that already went by.
        if (message.kind === "snapshot" && outOfStep()) {
          swap(message.snapshot);
        } else {
          session.receive(message);
        }
        deps.onChange?.();
      } catch {
        // A checkpoint this session cannot fold is the same recoverable condition
        // as a pause, not an error to surface. Keep the stride so the UI keeps
        // saying so, and allow the next tick to ask again.
        askedForCheckpoint = false;
      }
    },
  });

  return {
    get session(): Session<A, View> {
      return session;
    },
    get sync(): SyncState {
      return outOfStep() ? "resyncing" : "live";
    },
    tick: (): void => {
      session.tick();
      if (outOfStep()) {
        requestCheckpoint();
        return;
      }
      // The frames on the wire caught us up, so nothing is outstanding and the
      // next gap starts a fresh request.
      askedForCheckpoint = false;
    },
    close: teardown,
  };
};
