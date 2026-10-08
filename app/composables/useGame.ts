import {
  shallowRef,
  ref,
  watch,
  onUnmounted,
  type Ref,
  type ShallowRef,
} from "vue";
import {
  resign as resignInput,
  type GameDefinition,
  type SeatInput,
} from "#shared/core/lockstep/index.ts";
import type { UserId } from "#shared/rooms/ids.ts";
import type { G54Setup } from "#shared/core/lockstep/games/g54/setup.ts";
import {
  genesisFor,
  openGameSession,
  seatOf,
  type GameSession,
  type RoomLike,
} from "#shared/game/index.ts";
import { createGameChannel } from "./game-channel.ts";
import { pusherConfigFrom, sharedPusherClient } from "./useRoomChannel.ts";

export type GameStatus = "waiting" | "spectator" | "live" | "terminal" | "diverged";

export interface UseGame<A, View> {
  readonly view: ShallowRef<View | null>;
  readonly status: Ref<GameStatus>;
  readonly acted: Ref<boolean>;
  /** Ms left on the local seat's turn clock, or null when it owes nothing. */
  readonly remainingMs: Ref<number | null>;
  /** The full turn clock, so a timer can render a fraction as well as a number. */
  readonly inputTimeoutMs: number;
  report(input: SeatInput<A>): void;
  resign(): void;
}

/** The deadline-check cadence: tight, so peers carry an overdue frame within ~8ms of each other. */
export const TICK_MS = 16;

export const useGame = <S, A, View>(deps: {
  readonly game: GameDefinition<S, A, G54Setup, View>;
  readonly room: Ref<RoomLike | null>;
  readonly viewer: Ref<UserId | null>;
  readonly inputTimeoutMs?: number;
  readonly tickMs?: number;
}): UseGame<A, View> => {
  const view = shallowRef<View | null>(null);
  const status = ref<GameStatus>("waiting");
  const acted = ref(false);
  const remainingMs = ref<number | null>(null);
  const inputTimeoutMs = deps.inputTimeoutMs ?? 30000;

  let current: GameSession<A, View> | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastFrame = -1;
  let lastTerminal = false;

  const refresh = (): void => {
    if (current === null) return;
    const frame = current.session.frame;
    const terminal = current.session.terminal;
    if (frame !== lastFrame || terminal !== lastTerminal) {
      lastFrame = frame;
      lastTerminal = terminal;
      view.value = current.session.view();
      if (terminal) status.value = "terminal";
    }
    remainingMs.value = current.session.remainingMs();
  };

  const report = (input: SeatInput<A>): void => {
    if (current === null || status.value !== "live") return;
    current.session.report(input);
    acted.value = true;
    refresh();
  };

  const resign = (): void => {
    report(resignInput<A>());
  };

  if (!import.meta.client) {
    return { view, status, acted, remainingMs, inputTimeoutMs, report: () => {}, resign: () => {} };
  }

  const config = pusherConfigFrom(useRuntimeConfig().public.pusher);
  if (config === null) {
    return { view, status, acted, remainingMs, inputTimeoutMs, report, resign };
  }

  const dispose = (): void => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    current?.close();
    current = null;
  };

  watch(
    [deps.room, deps.viewer],
    async ([room, viewer]) => {
      if (room === null || viewer === null) return;
      const seat = seatOf(room.seats, viewer);
      if (seat === null) {
        status.value = "spectator";
        return;
      }
      dispose();
      const client = await sharedPusherClient(config);
      const channel = createGameChannel({ client, code: room.code });
      const session = openGameSession({
        game: deps.game,
        channel,
        seat,
        genesis: genesisFor(room),
        inputTimeoutMs: deps.inputTimeoutMs,
        onChange: () => {
          refresh();
          acted.value = false;
        },
        onError: () => {
          status.value = "diverged";
        },
      });
      current = session;
      lastFrame = -1;
      lastTerminal = false;
      status.value = "live";
      refresh();
      timer = setInterval(() => {
        session.session.tick();
        refresh();
      }, deps.tickMs ?? TICK_MS);
    },
    { immediate: true },
  );

  onUnmounted(dispose);

  return { view, status, acted, remainingMs, inputTimeoutMs, report, resign };
};
