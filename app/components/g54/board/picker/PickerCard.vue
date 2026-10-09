<script setup lang="ts">
import type { CardChoice, TargetCard } from "@/composables/window-menu.ts"
import RoleCard from "@/components/g54/RoleCard.vue"
import GeneralActionCard from "@/components/g54/GeneralActionCard.vue"
import PlayerCard from "@/components/g54/PlayerCard.vue"

defineProps<{ card: CardChoice | TargetCard; selected: boolean; disabled: boolean }>()
const emit = defineEmits<{ pick: [] }>()
</script>

<template>
  <div class="grid gap-1.5">
    <RoleCard
      v-if="card.face.kind === 'role'"
      :role="card.face.role"
      selectable
      :selected="selected"
      :disabled="disabled"
      @select="emit('pick')"
    />
    <GeneralActionCard
      v-else-if="card.face.kind === 'action'"
      :model="card.face.card"
      selectable
      :selected="selected"
      :disabled="disabled"
      @select="emit('pick')"
    />
    <PlayerCard
      v-else
      :seat="card.face.seat"
      :name="card.face.name"
      :image="card.face.image"
      selectable
      :selected="selected"
      :disabled="disabled"
      @select="emit('pick')"
    />
    <span class="text-muted-foreground min-h-3 text-xs leading-none italic">{{ card.reason ?? "" }}</span>
  </div>
</template>
