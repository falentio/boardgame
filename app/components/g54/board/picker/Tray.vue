<script setup lang="ts">
import { computed, toRef } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type { CardChoice, TargetCard, WindowMenu } from "@/composables/window-menu.ts"
import { Button } from "@/components/ui/button"
import { faceName, faceSummary, usePickerState } from "../window-picker-parts.ts"

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const busy = computed(() => props.busy === true)
const menu = toRef(props, "menu")
const { selectedId, targetIds, card: chosen, groups, ready, select, toggle, build } = usePickerState(menu, busy)

const targets = computed<readonly TargetCard[]>(() => groups.value.flatMap((group) => group.cards))

const chipLabel = (card: CardChoice): string =>
  [faceName(card.face), card.reason ?? faceSummary(card.face)].join(". ")
const chipClass = (card: CardChoice): string => {
  if (card.id === selectedId.value) return "bg-primary text-primary-foreground ring-transparent"
  if (busy.value || !card.enabled) return "text-muted-foreground ring-foreground/10 opacity-50"
  return "ring-foreground/15 hover:bg-muted"
}
const targetClass = (target: TargetCard): string => {
  if (targetIds.value.includes(target.id)) return "bg-primary text-primary-foreground ring-transparent"
  if (busy.value || !target.enabled) return "text-muted-foreground ring-foreground/10 opacity-50"
  return "ring-foreground/15 hover:bg-muted"
}

const status = computed<string>(() => {
  if (chosen.value === null) return "Pick an action to begin."
  if (groups.value.length > 0 && !ready.value) return `${faceName(chosen.value.face)}: pick a target.`
  return `${faceName(chosen.value.face)}: ${faceSummary(chosen.value.face)}`
})

const run = (): void => {
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
    <header class="flex items-baseline justify-between gap-3 border-b border-foreground/10 px-5 py-3">
      <div class="min-w-0">
        <h2 class="truncate text-sm font-semibold">
          {{ menu.title }}
        </h2>
        <p v-if="menu.note" class="text-muted-foreground truncate text-xs">
          {{ menu.note }}
        </p>
      </div>
      <p class="text-muted-foreground shrink-0 text-xs tabular-nums">
        {{ menu.cards.length }} options
      </p>
    </header>

    <div class="flex min-w-0 flex-1 flex-col justify-center gap-4 px-5 py-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="card in menu.cards"
          :key="card.id"
          type="button"
          class="rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          :class="chipClass(card)"
          :disabled="busy || !card.enabled"
          :aria-pressed="card.id === selectedId"
          :aria-label="chipLabel(card)"
          @click="select(card)"
        >
          {{ faceName(card.face) }}
        </button>
      </div>

      <div v-if="chosen !== null && targets.length > 0" class="flex flex-col gap-2">
        <p class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Pick a target
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="target in targets"
            :key="target.id"
            type="button"
            class="rounded-full px-3.5 py-1.5 text-sm ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            :class="targetClass(target)"
            :disabled="busy || !target.enabled"
            :aria-pressed="targetIds.includes(target.id)"
            :aria-label="faceName(target.face)"
            @click="toggle(target)"
          >
            {{ faceName(target.face) }}
          </button>
        </div>
      </div>
    </div>

    <footer class="flex items-center justify-between gap-3 border-t border-foreground/10 bg-muted/40 px-5 py-3">
      <p class="text-muted-foreground min-w-0 truncate text-sm">
        {{ status }}
      </p>
      <Button
        type="button"
        size="lg"
        :disabled="!ready"
        @click="run"
      >
        {{ chosen === null ? "Play" : `Play ${faceName(chosen.face)}` }}
      </Button>
    </footer>
  </section>
</template>
