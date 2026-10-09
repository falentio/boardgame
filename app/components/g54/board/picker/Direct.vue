<script setup lang="ts">
import { computed, toRef } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type { CardChoice, WindowMenu } from "@/composables/window-menu.ts"
import { Button } from "@/components/ui/button"
import { faceName, usePickerState } from "../window-picker-parts.ts"
import PickerCard from "./PickerCard.vue"

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const busy = computed(() => props.busy === true)
const menu = toRef(props, "menu")
const { selectedId, targetIds, card: chosen, groups, ready, select, toggle, build } = usePickerState(menu, busy)

const directAction = (card: CardChoice): G54Action | null =>
  !busy.value && card.enabled && card.target === null ? card.resolve() : null

const pick = (card: CardChoice): void => {
  select(card)
  const action = directAction(card)
  if (action !== null) emit("act", action)
}

const confirm = (): void => {
  const action = build()
  if (action !== null) emit("act", action)
}
</script>

<template>
  <section
    class="flex min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-card shadow-sm"
    data-slot="window-picker"
    role="group"
    :aria-label="menu.title"
  >
    <header class="border-b border-foreground/10 px-6 pt-5 pb-4">
      <p class="text-muted-foreground text-xs font-medium tracking-widest uppercase">
        {{ menu.title }}
      </p>
      <p v-if="menu.note" class="mt-1 text-base leading-snug font-medium">
        {{ menu.note }}
      </p>
    </header>

    <div class="flex min-w-0 flex-1 flex-col justify-center px-6 py-5">
      <div
        class="grid grid-flow-col grid-rows-[auto_auto] -mx-1 -mt-1 items-stretch gap-x-3 gap-y-1.5 overflow-x-auto px-1 pt-1 pb-3"
      >
        <template v-for="card in menu.cards" :key="card.id">
          <div class="row-span-2 w-40 shrink-0">
            <PickerCard
              :card="card"
              :selected="card.id === selectedId"
              :disabled="busy || !card.enabled"
              @pick="pick(card)"
            />
          </div>
        </template>
      </div>

      <div
        v-if="chosen !== null && groups.length > 0"
        class="mt-4 flex flex-col gap-2 border-t border-foreground/10 pt-4"
      >
        <p class="text-sm font-medium">
          {{ faceName(chosen.face) }}: pick a target
        </p>
        <div
          v-for="group in groups"
          :key="group.id"
          class="grid grid-flow-col grid-rows-[auto_auto] -mx-1 -mt-1 items-stretch gap-x-3 gap-y-1.5 overflow-x-auto px-1 pt-1 pb-3"
          role="group"
          aria-label="Target"
        >
          <div v-for="target in group.cards" :key="target.id" class="row-span-2 w-40 shrink-0">
            <PickerCard
              :card="target"
              :selected="targetIds.includes(target.id)"
              :disabled="busy || !target.enabled"
              @pick="toggle(target)"
            />
          </div>
        </div>
      </div>
    </div>

    <footer v-if="chosen !== null && groups.length > 0" class="border-t border-foreground/10 bg-muted/40 px-6 py-4">
      <p v-if="!ready" class="text-muted-foreground mb-2 text-xs">
        Pick a target above to finish.
      </p>
      <Button
        type="button"
        size="lg"
        class="w-full"
        :disabled="!ready"
        @click="confirm"
      >
        Do it: {{ faceName(chosen.face) }}
      </Button>
    </footer>
  </section>
</template>
