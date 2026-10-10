<script setup lang="ts">
import type { RoleId } from "#shared/core/lockstep/games/g54/roles.ts"
import RoleCard from "@/components/g54/RoleCard.vue"
import { ROLE_STRIP_CLASS, ROLE_STRIP_CARD_CLASS } from "@/composables/card-shell"

defineProps<{ roles: readonly RoleId[] }>()
</script>

<template>
  <div data-slot="role-strip" :class="ROLE_STRIP_CLASS">
    <RoleCard v-for="role in roles" :key="role" :role="role" :class="ROLE_STRIP_CARD_CLASS" />
  </div>
</template>
