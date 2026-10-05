<script setup lang="ts">
import type { RoleId } from "#shared/core/lockstep/games/g54/roles.ts"
import { Check } from "@lucide/vue"
import { Button } from "@/components/ui/button"
import { ROLE_GROUPS, roleOptionState, type RoleDraft } from "@/composables/roles"

const props = defineProps<{ draft: RoleDraft }>()

const emit = defineEmits<{
  toggle: [role: RoleId]
}>()

type OptionState = ReturnType<typeof roleOptionState>

const stateOf = (role: RoleId): OptionState => roleOptionState(props.draft, role)

const variantOf = (state: OptionState) => {
  if (state === "selected") return "default"
  if (state === "available") return "outline"
  return "ghost"
}

const artOf = (role: RoleId): string => `/roles/${role}.webp`
</script>

<template>
  <div class="flex flex-col gap-5">
    <div
      v-for="group in ROLE_GROUPS"
      :key="group.category"
      role="group"
      :aria-labelledby="`role-group-${group.category}`"
      class="flex flex-col gap-2"
    >
      <p :id="`role-group-${group.category}`" class="text-sm leading-none font-medium">
        {{ group.label }}
        <span class="text-muted-foreground tabular-nums">· {{ group.capacity }} required</span>
      </p>
      <div class="flex flex-col gap-1.5">
        <Button
          v-for="role in group.roles"
          :key="role.id"
          type="button"
          :variant="variantOf(stateOf(role.id))"
          :disabled="stateOf(role.id) === 'blocked'"
          :aria-pressed="stateOf(role.id) === 'selected'"
          data-role-option
          class="h-auto w-full items-center justify-start gap-3 whitespace-normal px-2 py-2 text-left"
          @click="emit('toggle', role.id)"
        >
          <span class="relative shrink-0">
            <img
              :src="artOf(role.id)"
              alt=""
              loading="lazy"
              decoding="async"
              class="size-11 rounded-full object-cover object-[50%_16%] ring-1 ring-foreground/10"
              :class="stateOf(role.id) === 'blocked' && 'opacity-50 grayscale'"
            >
            <span
              v-if="stateOf(role.id) === 'selected'"
              class="bg-primary text-primary-foreground absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full ring-2 ring-background"
            >
              <Check class="size-2.5" aria-hidden="true" />
            </span>
          </span>
          <span class="flex min-w-0 flex-col gap-0.5">
            <span class="text-sm font-medium">{{ role.name }}</span>
            <span
              class="text-xs leading-snug"
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
