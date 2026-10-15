<script setup lang="ts">
import { computed } from "vue"
import CharacterCard from "@/components/citadels/CharacterCard.vue"
import GameStatusPanel from "@/components/games/GameStatusPanel.vue"
import { Card, CardContent } from "@/components/ui/card"
import { ROLE_STRIP_CLASS, ROLE_STRIP_CARD_CLASS } from "@/composables/card-shell"
import type { Room } from "@/composables/room-domain.ts"
import { useGame } from "@/composables/useGame"
import type { RoomLike } from "#shared/game/index.ts"
import type { CitadelsSetup } from "#shared/core/lockstep/games/citadels/index.ts"
import { citadels } from "#shared/core/lockstep/games/citadels/index.ts"
import { seatId, type SeatId, type UserId } from "#shared/rooms/ids.ts"

const props = defineProps<{
  room: Room
  viewer: UserId | null
  loadFailed?: string | null
}>()

const citadelsRoom = computed<RoomLike<CitadelsSetup> | null>(() => {
  const room = props.room
  if (room.setup.game !== "citadels") return null
  return { code: room.code, setup: room.setup, seats: room.seats, startedAt: room.startedAt }
})

const viewer = computed(() => props.viewer)

const names = computed<ReadonlyMap<SeatId, string>>(() => {
  const map = new Map<SeatId, string>()
  for (const seat of props.room.seats) {
    if (seat.occupant === null) continue
    map.set(seatId(seat.id), seat.name ?? "Player")
  }
  return map
})

const { view, status } = useGame({
  game: citadels,
  room: citadelsRoom,
  viewer,
})

const nameOf = (seat: SeatId): string => names.value.get(seat) ?? seat

const players = computed(() =>
  view.value === null
    ? []
    : view.value.players.map((player) => ({
        seat: player.seat,
        name: nameOf(player.seat),
        gold: player.gold,
        handCount: player.handCount,
        cityCount: player.city.length,
        isCrown: player.seat === view.value?.crown,
        isActive: player.seat === view.value?.active,
        isMe: player.seat === view.value?.seat,
      })),
)

const purpose = computed(() => {
  const window = view.value?.window
  return window === null || window === undefined
    ? null
    : window.purpose.replaceAll("-", " ")
})

const winner = computed(() => {
  const current = view.value
  if (current === null || !current.terminal) return null
  return current.winner === null ? "Game over" : `${nameOf(current.winner)} wins`
})
</script>

<template>
  <GameStatusPanel :status="status" :failed="loadFailed">
    <div v-if="view" class="flex flex-col gap-4">
      <Card>
        <CardContent class="flex flex-col gap-3 pt-4">
          <div class="flex items-baseline justify-between gap-4">
            <p class="text-sm leading-none font-medium">
              Cast
            </p>
            <p class="text-muted-foreground text-sm leading-normal tabular-nums">
              Round {{ view.round }} · {{ view.cast.length }} characters
            </p>
          </div>
          <div data-slot="cast-strip" :class="ROLE_STRIP_CLASS">
            <CharacterCard
              v-for="character in view.cast"
              :key="character"
              :character="character"
              :class="ROLE_STRIP_CARD_CLASS"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent class="flex flex-col gap-3 pt-4">
          <p class="text-sm leading-none font-medium">
            Players
          </p>
          <ul class="flex flex-col gap-2">
            <li
              v-for="player in players"
              :key="player.seat"
              class="flex items-center justify-between gap-4 text-sm"
              :class="player.isActive && 'font-semibold'"
            >
              <span class="min-w-0 truncate">
                {{ player.name }}
                <span v-if="player.isMe" class="text-muted-foreground">(you)</span>
              </span>
              <span class="flex items-center gap-3 text-muted-foreground tabular-nums">
                <span v-if="player.isCrown" class="rounded-full bg-muted px-2 py-0.5 text-[0.625rem] uppercase">
                  Crown
                </span>
                <span>{{ player.gold }} gold</span>
                <span>{{ player.handCount }} cards</span>
                <span>{{ player.cityCount }} districts</span>
              </span>
            </li>
          </ul>
          <p v-if="purpose !== null" role="status" class="text-muted-foreground text-sm leading-normal">
            Waiting on the {{ purpose }} window.
          </p>
        </CardContent>
      </Card>

      <Card v-if="winner !== null">
        <CardContent class="flex flex-col gap-3 pt-4">
          <h2 class="text-lg leading-snug font-semibold">
            {{ winner }}
          </h2>
          <NuxtLink to="/" class="text-primary self-start text-sm underline-offset-4 hover:underline">
            Back to home
          </NuxtLink>
        </CardContent>
      </Card>
    </div>
  </GameStatusPanel>
</template>
