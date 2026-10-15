<script setup lang="ts">
import type { RoomSetup } from "#shared/rooms/games.ts"
import RoleCard from "@/components/g54/RoleCard.vue"
import { ROLE_STRIP_CLASS, ROLE_STRIP_CARD_CLASS } from "@/composables/card-shell"

defineProps<{ setup: RoomSetup }>()
</script>

<template>
  <div v-if="setup.game === 'g54'" data-slot="role-strip" :class="ROLE_STRIP_CLASS">
    <RoleCard v-for="role in setup.roles" :key="role" :role="role" :class="ROLE_STRIP_CARD_CLASS" />
  </div>
</template>
