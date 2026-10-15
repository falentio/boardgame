<script setup lang="ts">
import { computed, watch } from "vue"
import GameBoard from "@/components/g54/board/GameBoard.vue"
import TurnTimer from "@/components/g54/board/TurnTimer.vue"
import WindowPicker from "@/components/g54/board/WindowPicker.vue"
import WinnerCard, { type WinnerCardState } from "@/components/g54/WinnerCard.vue"
import GameStatusPanel from "@/components/games/GameStatusPanel.vue"
import { boardOf, type SeatIdentity } from "@/composables/board-view.ts"
import type { TurnClock } from "@/composables/turn-timer.ts"
import { forcedAction } from "@/composables/window-menu.ts"
import { useGame } from "@/composables/useGame"
import { useGameToasts } from "@/composables/useGameToasts"
import type { Room } from "@/composables/room-domain.ts"
import type { RoomLike } from "#shared/game/index.ts"
import type { G54Setup } from "#shared/core/lockstep/games/g54/setup.ts"
import { act } from "#shared/core/lockstep/index.ts"
import { g54 } from "#shared/core/lockstep/games/g54/index.ts"
import { seatId, type SeatId, type UserId } from "#shared/rooms/ids.ts"
import { resolveUserImage } from "#shared/users/avatar.ts"

const props = defineProps<{
  room: Room
  viewer: UserId | null
  loadFailed?: string | null
}>()

const g54Room = computed<RoomLike<G54Setup> | null>(() => {
  const room = props.room
  if (room.setup.game !== "g54") return null
  return { code: room.code, setup: room.setup, seats: room.seats, startedAt: room.startedAt }
})

const viewer = computed(() => props.viewer)

const identities = computed<ReadonlyMap<SeatId, SeatIdentity>>(() => {
  const map = new Map<SeatId, SeatIdentity>()
  for (const seat of props.room.seats) {
    if (seat.occupant === null) continue
    map.set(seatId(seat.id), {
      name: seat.name ?? "Player",
      image: resolveUserImage(seat.image, seat.occupant),
    })
  }
  return map
})

const { view, status, report, acted, resign, remainingMs, inputTimeoutMs } = useGame({
  game: g54,
  room: g54Room,
  viewer,
})

useGameToasts({ view, identities })

const board = computed(() => {
  const current = view.value
  if (current === null) return null
  return boardOf(current, identities.value)
})

const winner = computed(() => {
  const current = view.value
  if (current === null || !current.terminal) return null
  const seat = current.winner
  if (seat === null) return "Game over"
  return `${identities.value.get(seat)?.name ?? seat} wins`
})

const winnerCard = computed<WinnerCardState | null>(() => {
  const current = view.value
  if (current === null || !current.terminal) return null
  const identity = current.winner === null ? undefined : identities.value.get(current.winner)
  if (identity === undefined) return { kind: "over" }
  return { kind: "winner", name: identity.name, image: identity.image }
})

const forced = computed(() => {
  const menu = board.value?.menu
  return menu === null || menu === undefined ? null : forcedAction(menu)
})

const turnClock = computed<TurnClock | null>(() => {
  const remaining = remainingMs.value
  if (remaining === null || status.value !== "live" || winner.value !== null) return null
  return { remainingMs: remaining, totalMs: inputTimeoutMs }
})

watch(
  () => board.value?.menu ?? null,
  (menu) => {
    if (menu === null) return
    const action = forcedAction(menu)
    if (action !== null) report(act(action))
  },
  { immediate: true },
)
</script>

<template>
  <GameStatusPanel :status="status" :failed="loadFailed">
    <div v-if="board" class="flex flex-col gap-4">
      <WinnerCard v-if="winnerCard" :state="winnerCard" />
      <GameBoard :board="board" />
      <TurnTimer :clock="turnClock" />
      <p
        v-if="forced"
        role="status"
        class="text-muted-foreground text-sm leading-normal"
      >
        Waiting for the other players…
      </p>
      <WindowPicker
        v-else-if="board.menu"
        :menu="board.menu"
        :busy="acted"
        @act="report(act($event))"
      />
      <div v-if="!winnerCard">
        <button
          type="button"
          class="text-muted-foreground text-sm underline-offset-4 hover:underline transition-transform duration-150 ease-out active:scale-[0.97]"
          @click="resign"
        >
          Resign
        </button>
      </div>
    </div>
  </GameStatusPanel>
</template>
