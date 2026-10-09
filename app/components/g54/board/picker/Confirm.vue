<script setup lang="ts">
import { computed, toRef } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type { WindowMenu } from "@/composables/window-menu.ts"
import { Button } from "@/components/ui/button"
import { faceName, usePickerState } from "../window-picker-parts.ts"
import PickerCard from "./PickerCard.vue"

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const busy = computed(() => props.busy === true)
const menu = toRef(props, "menu")
const { selectedId, targetIds, card: chosen, groups, ready, select, toggle, build } = usePickerState(menu, busy)

const confirmLabel = computed(() =>
  chosen.value === null ? "Confirm" : `Confirm ${faceName(chosen.value.face)}`,
)

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
    <header class="border-b border-foreground/10 bg-muted/40 px-6 py-4">
      <h2 class="text-base leading-tight font-semibold">
        {{ menu.title }}
      </h2>
      <p v-if="menu.note" class="text-muted-foreground mt-0.5 text-sm leading-snug">
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
              @pick="select(card)"
            />
          </div>
        </template>
      </div>

      <div
        v-if="chosen !== null && groups.length > 0"
        class="flex flex-col gap-2 border-t border-foreground/10 pt-3"
      >
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

    <footer class="flex items-center justify-end gap-2 border-t border-foreground/10 bg-muted/40 px-6 py-3">
      <Button
        type="button"
        size="lg"
        :disabled="!ready"
        :aria-label="confirmLabel"
        @click="confirm"
      >
        Confirm
      </Button>
    </footer>
  </section>
</template>
