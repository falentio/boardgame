<script setup lang="ts">
import { computed, watch } from "vue"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import GameBoard from "@/components/g54/board/GameBoard.vue"
import TurnTimer from "@/components/g54/board/TurnTimer.vue"
import WindowPicker from "@/components/g54/board/WindowPicker.vue"
import WinnerCard, { type WinnerCardState } from "@/components/g54/WinnerCard.vue"
import { boardOf, type SeatIdentity } from "@/composables/board-view.ts"
import type { TurnClock } from "@/composables/turn-timer.ts"
import { forcedAction } from "@/composables/window-menu.ts"
import { useAuthSession } from "@/composables/useAuthSession"
import { useGame } from "@/composables/useGame"
import { useGameToasts } from "@/composables/useGameToasts"
import { useLobby } from "@/composables/useLobby"
import { act } from "#shared/core/lockstep/index.ts"
import { g54 } from "#shared/core/lockstep/games/g54/index.ts"
import { parseRoomCode } from "#shared/rooms/code.ts"
import { seatId, userId, type SeatId } from "#shared/rooms/ids.ts"
import { resolveUserImage } from "#shared/users/avatar.ts"

definePageMeta({ layout: "shell" })

const route = useRoute()
const rawCode = route.params.code
const code = parseRoomCode(Array.isArray(rawCode) ? (rawCode[0] ?? "") : String(rawCode ?? ""))

const { user } = await useAuthSession()
const viewer = computed(() => (user.value ? userId(user.value.id) : null))

const { lobby } = useLobby(code, viewer)

const room = computed(() => (lobby.value.kind === "room" ? lobby.value.room : null))

const loadFailed = computed(() => {
  const current = lobby.value
  if (current.kind === "invalid") return "That room code is not valid."
  if (current.kind === "missing") return "That room no longer exists. Check the code and try again."
  if (current.kind === "failed") return current.reason
  return null
})

const identities = computed<ReadonlyMap<SeatId, SeatIdentity>>(() => {
  const map = new Map<SeatId, SeatIdentity>()
  const current = room.value
  if (current === null) return map
  for (const seat of current.seats) {
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
  room,
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

/** The local seat's clock, or null when it owes nothing and there is nothing to show. */
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
  <div class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 pt-0">
    <Card>
      <CardContent class="pt-4">
        <Transition name="status" mode="out-in">
          <div v-if="loadFailed" key="failed" class="flex flex-col gap-3">
            <h1 class="text-2xl leading-tight font-semibold">
              Game
            </h1>
            <p class="text-destructive text-sm leading-normal">
              {{ loadFailed }}
            </p>
            <NuxtLink to="/" class="text-primary text-sm underline-offset-4 hover:underline">
              Back to the dashboard
            </NuxtLink>
          </div>

          <div v-else-if="status === 'waiting'" key="waiting" class="flex items-center gap-3">
            <h1 class="sr-only">
              Game
            </h1>
            <Spinner />
            <p role="status" class="text-muted-foreground text-sm leading-normal">
              Waiting for the game to start…
            </p>
          </div>

          <div v-else-if="status === 'spectator'" key="spectator" class="flex flex-col gap-3">
            <h1 class="text-2xl leading-tight font-semibold">
              Game
            </h1>
            <p class="text-muted-foreground text-sm leading-normal">
              You are not seated in this game, so you cannot see the board.
            </p>
            <NuxtLink to="/" class="text-primary text-sm underline-offset-4 hover:underline">
              Back to the dashboard
            </NuxtLink>
          </div>

          <div v-else-if="status === 'diverged'" key="diverged" class="flex flex-col gap-3">
            <h1 class="text-2xl leading-tight font-semibold">
              Game
            </h1>
            <p class="text-destructive text-sm leading-normal">
              This game fell out of sync with the other players. Reload the page to resync.
            </p>
          </div>

          <div v-else-if="board" key="board" class="flex flex-col gap-4">
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
            <div>
              <button
                type="button"
                class="text-muted-foreground text-sm underline-offset-4 hover:underline transition-transform duration-150 ease-out active:scale-[0.97]"
                @click="resign"
              >
                Resign
              </button>
            </div>
          </div>
        </Transition>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.status-enter-active,
.status-leave-active {
  transition: opacity 180ms var(--ease-out);
}

.status-enter-from,
.status-leave-to {
  opacity: 0;
}
</style>
