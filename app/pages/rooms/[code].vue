<script setup lang="ts">
import { computed, ref } from "vue"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import RoleCard from "@/components/g54/RoleCard.vue"
import SeatList from "@/components/room/SeatList.vue"
import ShareLink from "@/components/room/ShareLink.vue"
import { parseRoomCode } from "#shared/rooms/code.ts"
import { userId } from "#shared/rooms/ids.ts"
import { useAuthSession } from "@/composables/useAuthSession"
import { useLobby } from "@/composables/useLobby"

definePageMeta({ layout: "shell" })

const route = useRoute()
const rawCode = route.params.code
const code = parseRoomCode(Array.isArray(rawCode) ? (rawCode[0] ?? "") : String(rawCode ?? ""))

const { user } = await useAuthSession()
const viewer = computed(() => (user.value ? userId(user.value.id) : null))

const { lobby, refetch, join } = useLobby(code, viewer)

const joining = ref(false)
const joinError = ref("")

const plural = (count: number, singular: string): string => (count === 1 ? singular : `${singular}s`)

const onStart = async () => {
  const current = lobby.value
  if (current.kind !== "room") return
  await navigateTo(`/games/${current.room.code}`)
}

const onJoin = async () => {
  joinError.value = ""
  joining.value = true
  try {
    const outcome = await join()
    if (outcome.kind === "full") {
      joinError.value = "This room is full. Ask the host for a seat."
    } else if (outcome.kind === "missing") {
      joinError.value = "That room no longer exists. Check the code and try again."
    } else if (outcome.kind === "failed") {
      joinError.value = outcome.reason
    }
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-4 pt-0">
    <Card>
      <CardContent class="pt-4">
        <div v-if="lobby.kind === 'loading'" class="flex flex-col gap-3">
          <h1 class="sr-only">
            Room
          </h1>
          <div class="flex items-center gap-3">
            <Spinner />
            <p role="status" class="text-muted-foreground text-sm leading-normal">
              Loading room…
            </p>
          </div>
        </div>

        <div v-else-if="lobby.kind === 'invalid'" class="flex flex-col gap-3">
          <h1 class="text-2xl leading-tight font-semibold">
            Room
          </h1>
          <p class="text-sm leading-normal">
            That room code is not valid.
          </p>
          <NuxtLink to="/" class="text-primary text-sm underline-offset-4 hover:underline">
            Back to the dashboard
          </NuxtLink>
        </div>

        <div v-else-if="lobby.kind === 'missing'" class="flex flex-col gap-3">
          <h1 class="text-2xl leading-tight font-semibold">
            Room
          </h1>
          <p class="text-sm leading-normal">
            That room no longer exists. Check the code and try again.
          </p>
          <NuxtLink to="/" class="text-primary text-sm underline-offset-4 hover:underline">
            Back to the dashboard
          </NuxtLink>
        </div>

        <div v-else-if="lobby.kind === 'failed'" class="flex flex-col gap-3">
          <h1 class="text-2xl leading-tight font-semibold">
            Room
          </h1>
          <p class="text-destructive text-sm leading-normal">
            {{ lobby.reason }}
          </p>
          <div>
            <Button type="button" variant="outline" @click="refetch">
              Retry
            </Button>
          </div>
        </div>

        <div v-else class="flex flex-col gap-6">
          <div class="flex flex-col gap-2">
            <h1 class="truncate text-balance text-2xl leading-tight font-semibold" :title="lobby.room.name">
              {{ lobby.room.name }}
            </h1>
            <p class="text-muted-foreground text-sm leading-normal">
              Room code
              <span class="text-foreground font-mono tabular-nums">{{ lobby.room.code }}</span>
            </p>
          </div>

          <ShareLink :link="lobby.room.link" />

          <div class="flex flex-col gap-3">
            <p class="text-sm leading-none font-medium">
              Seats
            </p>
            <SeatList :seats="lobby.seats" />
            <p role="status" class="text-muted-foreground text-sm leading-normal tabular-nums">
              {{ lobby.status.kind === "full"
                ? "All seats filled"
                : `Waiting for ${lobby.status.total - lobby.status.filled} more ${plural(lobby.status.total - lobby.status.filled, "player")}` }}
            </p>
          </div>

          <div class="flex flex-col gap-3">
            <p class="text-sm leading-none font-medium">
              Roles
            </p>
            <div data-slot="role-strip" class="flex gap-3 overflow-x-auto pb-2">
              <RoleCard
                v-for="role in lobby.room.roles"
                :key="role"
                :role="role"
                class="w-40 shrink-0"
              />
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <template v-if="lobby.amIHost">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button type="button" :disabled="!lobby.canStart" @click="onStart">
                  Start game
                </Button>
                <p
                  v-if="lobby.status.kind === 'waiting'"
                  class="text-muted-foreground text-sm leading-normal tabular-nums"
                >
                  Waiting for {{ lobby.status.total - lobby.status.filled }} more
                </p>
              </div>
            </template>

            <p v-else-if="lobby.amISeated" class="text-muted-foreground text-sm leading-normal">
              Only the host can start the game.
            </p>

            <template v-else-if="lobby.status.kind === 'waiting'">
              <div>
                <Button type="button" :disabled="joining" @click="onJoin">
                  <Spinner v-if="joining" />
                  Join room
                </Button>
              </div>
              <p v-if="joinError" class="text-destructive text-sm leading-normal">
                {{ joinError }}
              </p>
            </template>

            <p v-else class="text-sm leading-normal">
              This room is full. Ask the host for a seat.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
