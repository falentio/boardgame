<script setup lang="ts">
import { computed, ref } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type { MenuOption, MenuSeatChoice, WindowMenu } from "@/composables/window-menu.ts"
import { isTurnMenu } from "@/composables/window-menu.ts"
import { Button } from "@/components/ui/button"
import RoleCard from "@/components/g54/RoleCard.vue"
import GeneralActionCard from "@/components/g54/GeneralActionCard.vue"

type FaceOption = Extract<MenuOption, { kind: "plain" | "target" }>

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const hasFace = (option: MenuOption): option is FaceOption =>
  (option.kind === "plain" || option.kind === "target") && option.face !== null

/** The picker owns the turn window only, so it renders when every option is a card. */
const isTurn = computed(() => isTurnMenu(props.menu))
const options = computed(() => props.menu.options.filter(hasFace))

const openId = ref<string | null>(null)

const isDisabled = (option: FaceOption): boolean => props.busy === true || !option.enabled

const choose = (option: FaceOption): void => {
  if (isDisabled(option)) return
  if (option.kind === "target") {
    openId.value = openId.value === option.id ? null : option.id
    return
  }
  emit("act", option.action())
}

const pick = (option: Extract<MenuOption, { kind: "target" }>, choice: MenuSeatChoice): void => {
  if (isDisabled(option) || !choice.enabled) return
  openId.value = null
  emit("act", option.action(choice.seat))
}
</script>

<template>
  <div
    v-if="isTurn"
    class="flex flex-col gap-3 rounded-xl border border-foreground/10 bg-card p-4"
    data-slot="turn-action-picker"
    role="group"
    :aria-label="menu.title"
  >
    <div class="flex flex-col gap-0.5">
      <h2 class="text-sm leading-tight font-semibold">
        {{ menu.title }}
      </h2>
      <p v-if="menu.note" class="text-muted-foreground text-xs leading-snug">
        {{ menu.note }}
      </p>
    </div>

    <ul class="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 min-[720px]:grid-cols-4">
      <li v-for="option in options" :key="option.id" class="flex min-w-0 flex-col gap-1.5">
        <RoleCard
          v-if="option.face?.kind === 'role'"
          :role="option.face.role"
          selectable
          :selected="openId === option.id"
          :disabled="isDisabled(option)"
          @select="choose(option)"
        />
        <GeneralActionCard
          v-else-if="option.face?.kind === 'general'"
          :action="option.face.action"
          selectable
          :selected="openId === option.id"
          :disabled="isDisabled(option)"
          @select="choose(option)"
        />
        <span
          v-if="option.reason && !busy"
          class="text-muted-foreground text-xs leading-none italic"
        >
          {{ option.reason }}
        </span>

        <div
          v-if="option.kind === 'target' && openId === option.id"
          class="flex flex-wrap gap-1.5"
          role="group"
          :aria-label="`${option.label} target`"
        >
          <Button
            v-for="choice in option.choices"
            :key="choice.seat"
            type="button"
            size="xs"
            variant="secondary"
            :disabled="isDisabled(option) || !choice.enabled"
            :title="choice.reason ?? undefined"
            @click="pick(option, choice)"
          >
            {{ choice.name }}
          </Button>
        </div>
      </li>
    </ul>
  </div>
</template>
