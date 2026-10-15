<script setup lang="ts">
import type { RoomSetup } from "#shared/rooms/games.ts"
import CharacterCard from "@/components/citadels/CharacterCard.vue"
import { ROLE_STRIP_CLASS, ROLE_STRIP_CARD_CLASS } from "@/composables/card-shell"

defineProps<{ setup: RoomSetup }>()
</script>

<template>
  <div v-if="setup.game === 'citadels'" data-slot="cast-strip" :class="ROLE_STRIP_CLASS">
    <CharacterCard
      v-for="character in setup.cast"
      :key="character"
      :character="character"
      :class="ROLE_STRIP_CARD_CLASS"
    />
  </div>
</template>
