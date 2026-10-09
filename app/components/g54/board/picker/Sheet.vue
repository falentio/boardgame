<script setup lang="ts">
import { computed, ref, toRef, watch } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type { CardChoice, TargetCard, WindowMenu } from "@/composables/window-menu.ts"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { faceName, faceSummary, usePickerState } from "../window-picker-parts.ts"
import PickerCard from "./PickerCard.vue"

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const busy = computed(() => props.busy === true)
const menu = toRef(props, "menu")
const { selectedId, targetIds, card: chosen, groups, ready, select, toggle, build } = usePickerState(menu, busy)

const open = ref(false)
const targets = computed<readonly TargetCard[]>(() => groups.value.flatMap((group) => group.cards))

watch(menu, () => {
  open.value = false
})

const cardLabel = (card: CardChoice): string =>
  [faceName(card.face), card.reason ?? faceSummary(card.face)].join(". ")

const choose = (card: CardChoice): void => {
  select(card)
  if (card.target === null) {
    const action = build()
    if (action !== null) emit("act", action)
    return
  }
  open.value = true
}

const run = (): void => {
  const action = build()
  if (action !== null) emit("act", action)
  open.value = false
}
</script>

<template>
  <section
    class="flex min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-foreground/10 bg-card shadow-sm"
    data-slot="window-picker"
    role="group"
    :aria-label="menu.title"
  >
    <header class="border-b border-foreground/10 bg-muted/40 px-6 py-4">
      <h2 class="text-base leading-tight font-semibold">
        {{ menu.title }}
      </h2>
      <p v-if="menu.note" class="text-muted-foreground mt-0.5 text-sm leading-snug">
        {{ menu.note }}
      </p>
    </header>

    <div class="flex min-w-0 flex-1 flex-col justify-center gap-2.5 px-6 py-5">
      <Button
        v-for="card in menu.cards"
        :key="card.id"
        type="button"
        size="lg"
        :variant="card.id === selectedId ? 'default' : 'outline'"
        class="h-auto w-full justify-start py-2.5"
        :disabled="busy || !card.enabled"
        :aria-label="cardLabel(card)"
        @click="choose(card)"
      >
        <span class="flex min-w-0 flex-col items-start text-left">
          <span class="text-sm font-semibold">{{ faceName(card.face) }}</span>
          <span
            class="text-xs font-normal"
            :class="card.id === selectedId ? 'text-primary-foreground/80' : 'text-muted-foreground'"
          >
            {{ card.reason ?? faceSummary(card.face) }}
          </span>
        </span>
      </Button>
    </div>
  </section>

  <Dialog v-model:open="open">
    <DialogContent class="max-sm:top-auto max-sm:bottom-0 max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ chosen === null ? "Choose a target" : faceName(chosen.face) }}</DialogTitle>
        <DialogDescription>
          {{ chosen === null ? "" : faceSummary(chosen.face) }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <PickerCard
          v-for="target in targets"
          :key="target.id"
          :card="target"
          :selected="targetIds.includes(target.id)"
          :disabled="busy || !target.enabled"
          @pick="toggle(target)"
        />
      </div>

      <div class="flex gap-2">
        <Button type="button" variant="outline" size="lg" class="flex-1" @click="open = false">
          Cancel
        </Button>
        <Button type="button" size="lg" class="flex-1" :disabled="!ready" @click="run">
          Confirm
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
