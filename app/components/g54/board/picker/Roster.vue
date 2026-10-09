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

const isDirect = (card: CardChoice): boolean => card.target === null
const rowLabel = (card: CardChoice): string =>
  [faceName(card.face), card.reason ?? faceSummary(card.face)].join(". ")
const initial = (card: CardChoice): string => faceName(card.face).slice(0, 1)

const runCard = (card: CardChoice): void => {
  if (busy.value || !card.enabled || card.target !== null) return
  emit("act", card.resolve())
}

const runTarget = (): void => {
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
    <header class="border-b border-foreground/10 px-6 py-5">
      <h2 class="text-lg leading-tight font-semibold">
        {{ menu.title }}
      </h2>
      <p v-if="menu.note" class="text-muted-foreground mt-1 text-sm leading-snug">
        {{ menu.note }}
      </p>
    </header>

    <div class="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-4">
      <div
        v-for="card in menu.cards"
        :key="card.id"
        class="flex items-center gap-2 rounded-xl px-2 py-2"
        :class="card.id === selectedId ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/60'"
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          :disabled="busy || !card.enabled"
          :aria-pressed="card.id === selectedId"
          :aria-label="rowLabel(card)"
          @click="select(card)"
        >
          <span
            class="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold"
            aria-hidden="true"
          >{{ initial(card) }}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ faceName(card.face) }}</span>
            <span class="text-muted-foreground block truncate text-xs">
              {{ card.reason ?? faceSummary(card.face) }}
            </span>
          </span>
        </button>
        <Button
          v-if="isDirect(card)"
          type="button"
          size="sm"
          variant="outline"
          :disabled="busy || !card.enabled"
          :aria-label="`${faceName(card.face)}, ${faceSummary(card.face)}`"
          @click="runCard(card)"
        >
          {{ card.face.kind === "action" ? card.face.card.label : "Choose" }}
        </Button>
      </div>

      <div
        v-if="chosen !== null && targets.length > 0"
        class="mt-3 flex flex-col gap-1.5 border-t border-foreground/10 pt-3"
      >
        <p class="text-muted-foreground px-2 text-xs font-medium tracking-wide uppercase">
          {{ faceName(chosen.face) }}: pick a target
        </p>
        <div
          v-for="target in targets"
          :key="target.id"
          class="flex items-center gap-2 rounded-xl px-2 py-2"
          :class="targetIds.includes(target.id) ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-muted/60'"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            :disabled="busy || !target.enabled"
            :aria-pressed="targetIds.includes(target.id)"
            :aria-label="faceName(target.face)"
            @click="toggle(target)"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium">{{ faceName(target.face) }}</span>
              <span v-if="target.reason" class="text-muted-foreground block truncate text-xs">
                {{ target.reason }}
              </span>
            </span>
          </button>
          <Button
            v-if="targetIds.includes(target.id) && ready"
            type="button"
            size="sm"
            :disabled="busy"
            @click="runTarget"
          >
            {{ target.face.kind === "player" ? "Target" : "Choose" }}
          </Button>
        </div>
      </div>
    </div>
  </section>
</template>
