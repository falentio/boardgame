<script setup lang="ts">
import { computed } from "vue"
import { GAME_UI } from "@/composables/game-ui"
import { useAuthSession } from "@/composables/useAuthSession"
import { useLobby } from "@/composables/useLobby"
import { parseRoomCode } from "#shared/rooms/code.ts"
import { userId } from "#shared/rooms/ids.ts"

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
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 pt-0">
    <Transition name="status" mode="out-in">
      <div v-if="room" :key="room.setup.game" class="flex flex-col gap-4">
        <component
          :is="GAME_UI[room.setup.game].screen"
          :room="room"
          :viewer="viewer"
          :load-failed="loadFailed"
        />
      </div>

      <div v-else key="loading" class="flex flex-col gap-3">
        <h1 class="text-2xl leading-tight font-semibold">
          Game
        </h1>
        <p v-if="loadFailed" class="text-destructive text-sm leading-normal">
          {{ loadFailed }}
        </p>
        <p v-else role="status" class="text-muted-foreground text-sm leading-normal">
          Loading game…
        </p>
        <NuxtLink
          v-if="loadFailed"
          to="/"
          class="text-primary text-sm underline-offset-4 hover:underline"
        >
          Back to the dashboard
        </NuxtLink>
      </div>
    </Transition>
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
