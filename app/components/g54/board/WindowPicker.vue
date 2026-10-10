<script setup lang="ts">
import { computed } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type { CardChoice, TargetCard, WindowMenu } from "@/composables/window-menu.ts"
import PlayerCard from "@/components/g54/PlayerCard.vue"
import RoleCard from "@/components/g54/RoleCard.vue"
import { Button } from "@/components/ui/button"
import { CARD_BADGE_CLASS, ROLE_STRIP_CARD_CLASS, ROLE_STRIP_CLASS } from "@/composables/card-shell"
import { roleCardModel, type RoleCardModel } from "@/composables/role-card"
import { faceName, faceSummary, usePickerState } from "./window-picker-parts.ts"
import FaceMedia from "./FaceMedia.vue"

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const busy = computed(() => props.busy === true)
const menu = computed(() => props.menu)
const {
  selectedId,
  targetIds,
  card: chosen,
  groups,
  skipSelect,
  pickedCount,
  required,
  ready,
  select,
  toggle,
  build,
} = usePickerState(menu, busy)

const roleMeta = (card: CardChoice | TargetCard): RoleCardModel | null =>
  card.face.kind === "role" ? roleCardModel(card.face.role) : null

/** Role rows borrow RoleCard's accessible name; other faces read their name and reason. */
const labelOf = (card: CardChoice | TargetCard): string => {
  const role = roleMeta(card)
  if (role !== null) return role.accessibleName
  return [faceName(card.face), card.reason ?? faceSummary(card.face)].join(". ")
}

/** RoleCard's states on the chip row: selected ring, disabled opacity, otherwise a hover. */
const rowClass = (card: CardChoice, selected: boolean): string => {
  if (selected) return "bg-primary/10 ring-2 ring-primary/40"
  if (busy.value || !card.enabled) return "opacity-50"
  return "hover:bg-muted/60"
}

const rowTextClass = (selected: boolean): string => (selected ? "whitespace-normal" : "truncate")

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
    <header class="border-b border-foreground/10 px-6 py-5">
      <h2 class="text-lg leading-tight font-semibold">
        {{ menu.title }}
      </h2>
      <p v-if="menu.note" class="text-muted-foreground mt-1 text-sm leading-snug">
        {{ menu.note }}
      </p>
    </header>

    <div class="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-4">
      <template v-if="!skipSelect">
        <button
          v-for="card in menu.cards"
          :key="card.id"
          type="button"
          class="picker-row flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          :class="rowClass(card, card.id === selectedId)"
          :disabled="busy || !card.enabled"
          :aria-pressed="card.id === selectedId"
          :aria-label="labelOf(card)"
          @click="select(card)"
        >
          <FaceMedia :face="card.face" />
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium" :class="rowTextClass(card.id === selectedId)">
              {{ faceName(card.face) }}
            </span>
            <span class="text-muted-foreground block text-xs" :class="rowTextClass(card.id === selectedId)">
              {{ card.reason ?? faceSummary(card.face) }}
            </span>
            <span v-if="roleMeta(card)" class="mt-1 flex flex-wrap items-center gap-1.5">
              <span v-if="roleMeta(card)?.cost" :class="CARD_BADGE_CLASS">{{ roleMeta(card)?.cost }}</span>
              <span v-if="roleMeta(card)?.block" :class="CARD_BADGE_CLASS">{{ roleMeta(card)?.block }}</span>
            </span>
          </span>
        </button>
      </template>

      <div
        v-if="chosen !== null && groups.length > 0"
        class="mt-3 flex flex-col gap-4"
        :class="skipSelect ? '' : 'border-t border-foreground/10 pt-3'"
      >
        <p class="px-2 text-sm font-medium tabular-nums">
          {{ pickedCount }} of {{ required }} chosen
        </p>

        <div
          v-for="group in groups"
          :key="group.id"
          role="group"
          :aria-labelledby="`target-group-${group.id}`"
          class="flex flex-col gap-2 px-2"
        >
          <p :id="`target-group-${group.id}`" class="text-sm font-medium">
            {{ faceName(chosen.face) }}
            <span class="text-muted-foreground">· pick {{ group.count }}</span>
          </p>

          <div data-slot="role-strip" :class="ROLE_STRIP_CLASS">
            <div
              v-for="(target, index) in group.cards"
              :key="target.id"
              class="target-card flex shrink-0 flex-col gap-1"
              :style="{ '--i': index }"
            >
              <RoleCard
                v-if="target.face.kind === 'role'"
                :role="target.face.role"
                :class="ROLE_STRIP_CARD_CLASS"
                selectable
                :selected="targetIds.includes(target.id)"
                :disabled="busy || !target.enabled"
                :aria-label="labelOf(target)"
                @select="toggle(target)"
              />
              <PlayerCard
                v-else-if="target.face.kind === 'player'"
                :seat="target.face.seat"
                :name="target.face.name"
                :image="target.face.image"
                :class="ROLE_STRIP_CARD_CLASS"
                selectable
                :selected="targetIds.includes(target.id)"
                :disabled="busy || !target.enabled"
                :aria-label="labelOf(target)"
                @select="toggle(target)"
              />
              <span v-if="target.reason" class="text-muted-foreground px-1 text-xs">
                {{ target.reason }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer class="flex items-center justify-end border-t border-foreground/10 bg-muted/40 px-6 py-3">
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

<style scoped>
[data-slot="window-picker"] {
  --enter-y: 8px;
  transition: opacity 220ms var(--ease-out), transform 220ms var(--ease-out);
}

/* The window opens once per turn: bridge its arrival. */
@starting-style {
  [data-slot="window-picker"] {
    opacity: 0;
    transform: translateY(var(--enter-y));
  }
}

/* Press feedback and the selected state settling, on the row itself. */
.picker-row {
  transition:
    transform 160ms var(--ease-out),
    background-color 150ms ease,
    box-shadow 150ms ease;
}

.picker-row:active {
  transform: scale(0.98);
}

.target-card {
  --rise-y: 8px;
  animation: picker-rise 200ms var(--ease-out) backwards;
  animation-delay: calc(var(--i, 0) * 40ms);
}

@keyframes picker-rise {
  from {
    opacity: 0;
    transform: translateY(var(--rise-y));
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-slot="window-picker"] {
    --enter-y: 0px;
  }

  .picker-row {
    transition:
      background-color 150ms ease,
      box-shadow 150ms ease;
  }

  .picker-row:active {
    transform: none;
  }

  .target-card {
    --rise-y: 0px;
    animation-delay: 0ms;
  }
}
</style>
