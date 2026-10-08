import {
  createSession,
  deadline,
  makeRoster,
  type Clock,
  type Frame,
  type GameDefinition,
  type Inbound,
  type Roster,
  type SeatId,
  type Seed,
  type Session,
  type SessionPort,
} from "../../index.ts";

/** A clock the test drives by hand; the primitive only ever calls `now()`. */
export interface FakeClock {
  readonly clock: Clock;
  advance(ms: number): void;
}

export const fakeClock = (start = 0): FakeClock => {
  let now = start;
  return {
    clock: { now: () => now },
    advance: (ms: number): void => {
      now += ms;
    },
  };
};

/** A port that drops everything, for sessions driven directly by the test. */
export const nullPort = <A>(): SessionPort<A> => ({
  sendReport: (): void => undefined,
  send: (): void => undefined,
  sendSnapshot: (): void => undefined,
});

export interface TableOptions<Setup> {
  readonly seats: readonly SeatId[];
  readonly setup: Setup;
  readonly seed: Seed;
  readonly clock: Clock;
  readonly timeoutMs?: number;
  /** The agreed frame-0 epoch. Defaults to 0, so a fresh clock sees a full budget. */
  readonly startedAt?: number;
}

/**
 * A synchronous broadcast bus. Each session's port delivers to every other
 * session immediately, which is the cooperative, reliable channel the primitive
 * assumes. `sealed` records every frame any peer broadcast, deduplicated by
 * index, so a test can inspect exactly what the log agreed.
 */
export interface Table<A, View> {
  readonly sessions: ReadonlyMap<SeatId, Session<A, View>>;
  readonly roster: Roster;
  readonly sealed: ReadonlyMap<number, Frame<A>>;
}

export const makeTable = <S, A, Setup, View>(
  game: GameDefinition<S, A, Setup, View>,
  options: TableOptions<Setup>,
): Table<A, View> => {
  const sessions = new Map<SeatId, Session<A, View>>();
  const sealed = new Map<number, Frame<A>>();
  const roster = makeRoster(options.seats);
  const deliver = (from: SeatId, message: Inbound<A>): void => {
    if (message.kind === "frame") sealed.set(message.frame.index, message.frame);
    for (const [seat, session] of sessions) {
      if (seat !== from) session.receive(message);
    }
  };
  for (const seat of options.seats) {
    const port: SessionPort<A> = {
      sendReport: (report): void => deliver(seat, { kind: "report", report }),
      send: (frame): void => deliver(seat, { kind: "frame", frame }),
      sendSnapshot: (snapshot): void => deliver(seat, { kind: "snapshot", snapshot }),
    };
    sessions.set(
      seat,
      createSession<S, A, Setup, View>(
        {
          game,
          port,
          clock: options.clock,
          config: { seat, inputTimeoutMs: options.timeoutMs ?? 1000 },
        },
        {
          seed: options.seed,
          roster,
          setup: options.setup,
          startedAt: deadline(options.startedAt ?? 0),
        },
      ),
    );
  }
  return { sessions, roster, sealed };
};

/** The session for a seat, or a loud failure. */
export const at = <A, View>(table: Table<A, View>, seat: SeatId): Session<A, View> => {
  const session = table.sessions.get(seat);
  if (session === undefined) throw new Error(`no session for seat ${seat}`);
  return session;
};

/** A session whose port records every frame it broadcasts and reaches nobody. */
export interface Recording<A, View> {
  readonly session: Session<A, View>;
  readonly frames: Frame<A>[];
}

export const recordingSession = <S, A, Setup, View>(
  game: GameDefinition<S, A, Setup, View>,
  options: TableOptions<Setup> & { readonly seat: SeatId },
): Recording<A, View> => {
  const frames: Frame<A>[] = [];
  const port: SessionPort<A> = {
    sendReport: (): void => undefined,
    send: (frame): void => {
      frames.push(frame);
    },
    sendSnapshot: (): void => undefined,
  };
  const session = createSession<S, A, Setup, View>(
    {
      game,
      port,
      clock: options.clock,
      config: { seat: options.seat, inputTimeoutMs: options.timeoutMs ?? 1000 },
    },
    {
      seed: options.seed,
      roster: makeRoster(options.seats),
      setup: options.setup,
      startedAt: deadline(options.startedAt ?? 0),
    },
  );
  return { session, frames };
};
