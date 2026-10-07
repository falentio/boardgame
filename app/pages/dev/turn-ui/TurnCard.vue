<script setup lang="ts">
import type { MenuSeatChoice } from "@/composables/window-menu.ts"
import type { TurnFaceOption } from "./useTurnCards.ts"
import RoleCard from "@/components/g54/RoleCard.vue"
import GeneralActionCard from "@/components/g54/GeneralActionCard.vue"

const props = defineProps<{
  option: TurnFaceOption
  busy?: boolean
  selected: boolean
}>()

const emit = defineEmits<{
  choose: []
  pick: [choice: MenuSeatChoice]
}>()

const disabled = (): boolean => props.busy === true || !props.option.enabled

const onPick = (choice: MenuSeatChoice): void => {
  if (disabled() || !choice.enabled) return
  emit("pick", choice)
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <RoleCard
      v-if="option.face?.kind === 'role'"
      :role="option.face.role"
      selectable
      :selected="selected"
      :disabled="disabled()"
      @select="emit('choose')"
    />
    <GeneralActionCard
      v-else-if="option.face?.kind === 'general'"
      :action="option.face.action"
      selectable
      :selected="selected"
      :disabled="disabled()"
      @select="emit('choose')"
    />

    <span v-if="option.reason && !busy" class="text-muted-foreground text-xs leading-none italic">
      {{ option.reason }}
    </span>

    <div
      v-if="option.kind === 'target' && selected"
      class="flex flex-wrap gap-1.5"
      role="group"
      :aria-label="`${option.label} target`"
    >
      <button
        v-for="choice in option.choices"
        :key="choice.seat"
        type="button"
        class="h-6 rounded-md bg-secondary px-2 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="disabled() || !choice.enabled"
        :title="choice.reason ?? undefined"
        @click="onPick(choice)"
      >
        {{ choice.name }}
      </button>
    </div>
  </div>
</template>
