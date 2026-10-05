import { computed, onMounted, ref, type ComputedRef, type Ref } from "vue";
import type { RoomCode, UserId } from "#shared/rooms/ids.ts";
import { keepLastGood, lobbyOf, type Lobby, type RoomLoad } from "./room-domain.ts";
import { createRoomRefresher } from "./room-refresh.ts";
import { fetchRoom, joinRoom, type JoinOutcome } from "./rooms-api.ts";
import { useRoomChannel } from "./useRoomChannel.ts";

export interface UseLobby {
  lobby: ComputedRef<Lobby>;
  refetch: () => void;
  join: () => Promise<JoinOutcome>;
}

export const useLobby = (code: RoomCode | null, viewer: Ref<UserId | null>): UseLobby => {
  const load = ref<RoomLoad>(code === null ? { kind: "invalid" } : { kind: "loading" });
  const lobby = computed(() => lobbyOf(load.value, viewer.value));

  let refresh: () => void = () => {};

  if (import.meta.client && code !== null) {
    const roomCode = code;
    refresh = createRoomRefresher({
      fetchRoom: () => fetchRoom(roomCode),
      onRoom: (next) => {
        load.value = keepLastGood(load.value, next);
      },
    });
    onMounted(() => refresh());
    useRoomChannel(roomCode, () => refresh());
  }

  const join = async (): Promise<JoinOutcome> => {
    if (code === null) return { kind: "failed", reason: "invalid room code" };
    const outcome = await joinRoom(code);
    if (outcome.kind === "joined" || outcome.kind === "already-seated") refresh();
    return outcome;
  };

  return { lobby, refetch: () => refresh(), join };
};
