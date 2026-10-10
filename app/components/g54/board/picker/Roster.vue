<script setup lang="ts">
import { computed, toRef } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type { CardChoice, TargetCard, WindowMenu } from "@/composables/window-menu.ts"
import { Button } from "@/components/ui/button"
import { CARD_BADGE_CLASS } from "@/composables/card-shell"
import { roleCardModel, type RoleCardModel } from "@/composables/role-card"
import { faceName, faceSummary, usePickerState } from "../window-picker-parts.ts"
import FaceMedia from "./FaceMedia.vue"

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const busy = computed(() => props.busy === true)
const menu = toRef(props, "menu")
const { selectedId, targetIds, card: chosen, groups, ready, select, toggle, build } = usePickerState(menu, busy)

const targets = computed<readonly TargetCard[]>(() => groups.value.flatMap((group) => group.cards))

const isDirect = (card: CardChoice): boolean => card.target === null
const roleMeta = (card: CardChoice | TargetCard): RoleCardModel | null =>
  card.face.kind === "role" ? roleCardModel(card.face.role) : null

/** Role rows borrow RoleCard's accessible name; other faces read their name and reason. */
const labelOf = (card: CardChoice | TargetCard): string => {
  const role = roleMeta(card)
  if (role !== null) return role.accessibleName
  return [faceName(card.face), card.reason ?? faceSummary(card.face)].join(". ")
}

/** RoleCard's states on the chip row: selected ring, disabled opacity, otherwise a hover. */
const rowClass = (card: CardChoice | TargetCard, selected: boolean): string => {
  if (selected) return "bg-primary/10 ring-2 ring-primary/40"
  if (busy.value || !card.enabled) return "opacity-50"
  return "hover:bg-muted/60"
}

/** A direct row fires; a staged row selects to reveal its target stage. */
const activate = (card: CardChoice): void => {
  if (busy.value || !card.enabled) return
  if (card.target === null) {
    emit("act", card.resolve())
    return
  }
  select(card)
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
      <button
        v-for="card in menu.cards"
        :key="card.id"
        type="button"
        class="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        :class="rowClass(card, card.id === selectedId)"
        :disabled="busy || !card.enabled"
        :aria-pressed="card.id === selectedId"
        :aria-label="labelOf(card)"
        @click="activate(card)"
      >
        <FaceMedia :face="card.face" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium">{{ faceName(card.face) }}</span>
          <span class="text-muted-foreground block truncate text-xs">
            {{ card.reason ?? faceSummary(card.face) }}
          </span>
          <span v-if="roleMeta(card)" class="mt-1 flex flex-wrap items-center gap-1.5">
            <span v-if="roleMeta(card)?.cost" :class="CARD_BADGE_CLASS">{{ roleMeta(card)?.cost }}</span>
            <span v-if="roleMeta(card)?.block" :class="CARD_BADGE_CLASS">{{ roleMeta(card)?.block }}</span>
          </span>
        </span>
      </button>

      <div
        v-if="chosen !== null && targets.length > 0"
        class="mt-3 flex flex-col gap-1.5 border-t border-foreground/10 pt-3"
      >
        <p class="text-muted-foreground px-2 text-xs font-medium tracking-wide uppercase">
          {{ faceName(chosen.face) }}: pick a target
        </p>
        <button
          v-for="target in targets"
          :key="target.id"
          type="button"
          class="flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          :class="rowClass(target, targetIds.includes(target.id))"
          :disabled="busy || !target.enabled"
          :aria-pressed="targetIds.includes(target.id)"
          :aria-label="labelOf(target)"
          @click="toggle(target)"
        >
          <FaceMedia :face="target.face" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ faceName(target.face) }}</span>
            <span v-if="target.reason" class="text-muted-foreground block truncate text-xs">
              {{ target.reason }}
            </span>
          </span>
        </button>
        <Button
          v-if="ready"
          type="button"
          size="lg"
          class="mt-1 w-full"
          :disabled="busy"
          :aria-label="`Confirm ${faceName(chosen.face)}`"
          @click="runTarget"
        >
          Confirm {{ faceName(chosen.face) }}
        </Button>
      </div>
    </div>
  </section>
</template>
