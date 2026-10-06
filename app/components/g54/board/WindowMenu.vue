<script setup lang="ts">
import { ref } from "vue"
import { Button } from "@/components/ui/button"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type { SeatId } from "#shared/rooms/ids.ts"
import type { MenuOption, WindowMenu } from "@/composables/window-menu.ts"

type TargetOption = Extract<MenuOption, { kind: "target" }>

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const openId = ref<string | null>(null)

const isDisabled = (option: MenuOption): boolean => props.busy === true || !option.enabled

const choose = (option: MenuOption): void => {
  if (isDisabled(option)) return
  if (option.kind === "target") {
    openId.value = openId.value === option.id ? null : option.id
    return
  }
  emit("act", option.action())
}

const pick = (option: TargetOption, seat: SeatId): void => {
  if (props.busy === true) return
  openId.value = null
  emit("act", option.action(seat))
}
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-card p-4"
    data-slot="window-menu"
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

    <ul class="flex flex-col gap-2">
      <li
        v-for="option in menu.options"
        :key="option.id"
        class="flex flex-col gap-1.5"
      >
        <div class="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            :disabled="isDisabled(option)"
            :aria-expanded="option.kind === 'target' ? openId === option.id : undefined"
            @click="choose(option)"
          >
            {{ option.label }}
          </Button>
          <span v-if="option.detail" class="text-muted-foreground text-xs leading-none">
            {{ option.detail }}
          </span>
          <span
            v-if="option.reason && !busy"
            class="text-muted-foreground text-xs leading-none italic"
          >
            {{ option.reason }}
          </span>
        </div>

        <div
          v-if="option.kind === 'target' && openId === option.id"
          class="flex flex-wrap gap-1.5 ps-1"
          role="group"
          :aria-label="`${option.label} target`"
        >
          <Button
            v-for="choice in option.choices"
            :key="choice.seat"
            type="button"
            size="xs"
            variant="secondary"
            :disabled="busy"
            @click="pick(option, choice.seat)"
          >
            {{ choice.name }}
          </Button>
        </div>
      </li>
    </ul>
  </div>
</template>
