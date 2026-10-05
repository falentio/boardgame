<script setup lang="ts">
import type { RoleId } from "#shared/core/lockstep/games/g54/roles.ts"
import { Button } from "@/components/ui/button"
import { ROLE_GROUPS, roleOptionState, toggleRole, type RoleDraft } from "@/composables/roles"

const props = defineProps<{ draft: RoleDraft }>()

const emit = defineEmits<{
  "update:draft": [draft: RoleDraft]
}>()

type OptionState = ReturnType<typeof roleOptionState>

const stateOf = (role: RoleId): OptionState => roleOptionState(props.draft, role)

const variantOf = (state: OptionState) => {
  if (state === "selected") return "default"
  if (state === "available") return "outline"
  return "ghost"
}

const pick = (role: RoleId) => {
  emit("update:draft", toggleRole(props.draft, role))
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div
      v-for="group in ROLE_GROUPS"
      :key="group.category"
      role="group"
      :aria-labelledby="`role-group-${group.category}`"
      class="flex flex-col gap-3"
    >
      <p :id="`role-group-${group.category}`" class="text-sm leading-none font-medium">
        {{ group.label }}
        <span class="text-muted-foreground tabular-nums">· {{ group.capacity }} required</span>
      </p>
      <div class="grid gap-2 sm:grid-cols-2">
        <Button
          v-for="role in group.roles"
          :key="role.id"
          type="button"
          :variant="variantOf(stateOf(role.id))"
          :disabled="stateOf(role.id) === 'blocked'"
          :aria-pressed="stateOf(role.id) === 'selected'"
          data-role-option
          :class="stateOf(role.id) === 'blocked' ? 'text-muted-foreground' : undefined"
          class="h-auto w-full items-start justify-start gap-0 whitespace-normal px-3 py-2 text-left"
          @click="pick(role.id)"
        >
          <span class="flex min-w-0 flex-col gap-0.5">
            <span class="font-medium">{{ role.name }}</span>
            <span
              class="text-xs leading-normal"
              :class="stateOf(role.id) === 'selected' ? 'text-primary-foreground/80' : 'text-muted-foreground'"
            >
              {{ role.summary }}
            </span>
          </span>
        </Button>
      </div>
    </div>
  </div>
</template>
