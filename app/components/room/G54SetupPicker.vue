<script setup lang="ts">
import type { RoomSetup } from "#shared/rooms/games.ts"
import { ref } from "vue"
import RolePicker from "@/components/room/RolePicker.vue"
import { completeRoles, defaultDraft, missingLabels, type RoleDraft } from "@/composables/roles"

defineProps<{ setup: RoomSetup | null }>()

const emit = defineEmits<{
  change: [setup: RoomSetup | null, missing: readonly string[]]
}>()

const draft = ref<RoleDraft>(defaultDraft())

const onChange = (next: RoleDraft) => {
  draft.value = next
  const roles = completeRoles(next)
  emit("change", roles === null ? null : { game: "g54", roles }, missingLabels(next))
}
</script>

<template>
  <RolePicker :draft="draft" @change="onChange" />
</template>
