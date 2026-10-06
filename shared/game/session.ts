import {
  createSession,
  type Clock,
  type GameDefinition,
  type GenesisInput,
  type SeatId,
  type Session,
  type SessionPort,
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
  readonly onError?: (error: Error) => void;
}

export interface GameSession<A, View> {
  readonly session: Session<A, View>;
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

  const session = createSession<S, A, Setup, View>(
    {
      game: deps.game,
      port,
      clock: deps.clock ?? { now: () => Date.now() },
      config: { seat: deps.seat, inputTimeoutMs: deps.inputTimeoutMs ?? 30000 },
    },
    deps.genesis,
  );

  const requestSync = (): void => {
    deps.channel.publish(encodeEnvelope({ kind: "sync" }));
  };

  const teardown = deps.channel.subscribe({
    onConnected: requestSync,
    onMessage: (data): void => {
      const message = decodeMessage(deps.game, data);
      if (message === null) return;
      if (message.kind === "sync") {
        if (session.frame > 0) port.sendSnapshot(session.snapshot());
        return;
      }
      try {
        session.receive(message);
        deps.onChange?.();
      } catch (error) {
        deps.onError?.(error as Error);
      }
    },
  });

  return { session, close: teardown };
};
