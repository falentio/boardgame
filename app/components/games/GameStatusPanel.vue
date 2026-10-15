<script setup lang="ts">
import { Spinner } from "@/components/ui/spinner"
import type { GameStatus } from "@/composables/useGame"

defineProps<{
  status: GameStatus
  failed?: string | null
}>()
</script>

<template>
  <div v-if="failed" class="flex flex-col gap-3">
    <h1 class="text-2xl leading-tight font-semibold">
      Game
    </h1>
    <p class="text-destructive text-sm leading-normal">
      {{ failed }}
    </p>
    <NuxtLink to="/" class="text-primary text-sm underline-offset-4 hover:underline">
      Back to the dashboard
    </NuxtLink>
  </div>

  <div v-else-if="status === 'waiting'" class="flex items-center gap-3">
    <h1 class="sr-only">
      Game
    </h1>
    <Spinner />
    <p role="status" class="text-muted-foreground text-sm leading-normal">
      Waiting for the game to start…
    </p>
  </div>

  <div v-else-if="status === 'spectator'" class="flex flex-col gap-3">
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

  <div v-else-if="status === 'resyncing'" class="flex flex-col gap-3">
    <h1 class="text-2xl leading-tight font-semibold">
      Game
    </h1>
    <div class="flex items-center gap-3">
      <Spinner />
      <p role="status" class="text-muted-foreground text-sm leading-normal">
        This tab fell out of step with the other players. Resyncing…
      </p>
    </div>
  </div>

  <slot v-else />
</template>
