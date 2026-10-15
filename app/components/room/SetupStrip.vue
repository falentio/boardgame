<script setup lang="ts">
import type { RoomSetup } from "#shared/rooms/games.ts"
import { GAME_UI } from "@/composables/game-ui"

defineProps<{ setup: RoomSetup }>()
</script>

<template>
  <component :is="GAME_UI[setup.game].lobbySetup" :setup="setup" />
</template>
