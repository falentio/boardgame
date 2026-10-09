<script setup lang="ts">
import type { RoleId } from "#shared/core/lockstep/games/g54/roles.ts"
import { computed } from "vue"
import RoleCard from "@/components/g54/RoleCard.vue"
import { ROLE_STRIP_CLASS, ROLE_STRIP_CARD_CLASS } from "@/composables/card-shell"
import { filledCount, isPicked, mergedGroups, pickRole, type RoleDraft } from "@/composables/roles"

const props = defineProps<{ draft: RoleDraft }>()

const emit = defineEmits<{
  change: [draft: RoleDraft]
}>()

const count = computed(() => filledCount(props.draft))
const picked = (role: RoleId) => isPicked(props.draft, role)
const choose = (role: RoleId) => emit("change", pickRole(props.draft, role))
</script>

<template>
  <div class="flex flex-col gap-5">
    <p class="text-sm leading-none font-medium tabular-nums">{{ count }} of 5 chosen</p>

    <div
      v-for="group in mergedGroups"
      :key="group.key"
      role="group"
      :aria-labelledby="`role-group-${group.key}`"
      class="flex flex-col gap-2"
    >
      <p :id="`role-group-${group.key}`" class="text-sm leading-none font-medium">
        {{ group.label }}
        <span v-if="group.key === 'special'" class="text-muted-foreground">· pick 2</span>
      </p>

      <div data-slot="role-strip" :class="ROLE_STRIP_CLASS">
        <RoleCard
          v-for="role in group.roles"
          :key="role.id"
          :role="role.id"
          :class="ROLE_STRIP_CARD_CLASS"
          selectable
          :selected="picked(role.id)"
          data-role-option
          @select="choose(role.id)"
        />
      </div>
    </div>
  </div>
</template>
