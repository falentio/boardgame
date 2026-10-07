<script setup lang="ts">
import { computed, ref } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import { specOf } from "#shared/core/lockstep/games/g54/roles.ts"
import {
  confirmable,
  type CardChoice,
  type CardFace,
  type TargetCard,
  type TargetGroup,
  type WindowMenu,
} from "@/composables/window-menu.ts"
import { Button } from "@/components/ui/button"
import RoleCard from "@/components/g54/RoleCard.vue"
import GeneralActionCard from "@/components/g54/GeneralActionCard.vue"
import PlayerCard from "@/components/g54/PlayerCard.vue"

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const busy = computed(() => props.busy === true)

const selectedCardId = ref<string | null>(null)
const selectedTargetIds = ref<readonly string[]>([])

const selectedCard = computed<CardChoice | null>(
  () => props.menu.cards.find((card) => card.id === selectedCardId.value) ?? null,
)
const groups = computed<readonly TargetGroup[]>(() => selectedCard.value?.target ?? [])
const selectedTargets = computed<readonly TargetCard[]>(() =>
  groups.value
    .flatMap((group) => group.cards)
    .filter((card) => selectedTargetIds.value.includes(card.id)),
)

const confirmReady = computed(
  () => selectedCard.value !== null && confirmable(selectedCard.value, selectedTargets.value),
)

const faceName = (face: CardFace): string => {
  if (face.kind === "role") return specOf(face.role).name
  if (face.kind === "action") return face.card.label
  return face.name
}

const confirmLabel = computed<string>(() =>
  selectedCard.value === null ? "Confirm" : `Confirm ${faceName(selectedCard.value.face)}`,
)

const isCardDisabled = (card: CardChoice): boolean => busy.value || !card.enabled

const startsGroup = (index: number): boolean => {
  const cards = props.menu.cards
  const previous = cards[index - 1]
  const card = cards[index]
  if (card === undefined || previous === undefined) return false
  return card.group !== previous.group
}

const select = (card: CardChoice): void => {
  if (isCardDisabled(card)) return
  selectedCardId.value = card.id
  selectedTargetIds.value = []
}

const groupOf = (target: TargetCard): TargetGroup | null =>
  groups.value.find((group) => group.cards.includes(target)) ?? null

const isTargetSelected = (target: TargetCard): boolean =>
  selectedTargetIds.value.includes(target.id)

const toggleTarget = (target: TargetCard): void => {
  if (busy.value || !target.enabled) return
  if (isTargetSelected(target)) {
    selectedTargetIds.value = selectedTargetIds.value.filter((id) => id !== target.id)
    return
  }
  const group = groupOf(target)
  if (group === null) return
  const chosen = group.cards.filter(isTargetSelected).length
  if (chosen >= group.count) return
  selectedTargetIds.value = [...selectedTargetIds.value, target.id]
}

const confirm = (): void => {
  const card = selectedCard.value
  if (card === null || !confirmReady.value) return
  emit("act", card.target === null ? card.resolve() : card.resolve(selectedTargets.value))
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
      <div class="flex min-w-0 flex-col gap-2">
        <div
          class="grid grid-flow-col grid-rows-[auto_auto] items-stretch gap-x-3 gap-y-1.5 overflow-x-auto pb-3"
        >
          <template v-for="(card, index) in menu.cards" :key="card.id">
            <div
              v-if="startsGroup(index)"
              class="row-span-2 w-px self-stretch bg-foreground/15"
              aria-hidden="true"
            />
            <div
              class="window-card-cell row-span-2 grid w-40 min-w-0 shrink-0 grid-rows-subgrid gap-1.5"
            >
              <RoleCard
                v-if="card.face.kind === 'role'"
                :role="card.face.role"
                selectable
                :selected="card.id === selectedCardId"
                :disabled="isCardDisabled(card)"
                @select="select(card)"
              />
              <GeneralActionCard
                v-else-if="card.face.kind === 'action'"
                :model="card.face.card"
                selectable
                :selected="card.id === selectedCardId"
                :disabled="isCardDisabled(card)"
                @select="select(card)"
              />
              <PlayerCard
                v-else
                :seat="card.face.seat"
                :name="card.face.name"
                :image="card.face.image"
                selectable
                :selected="card.id === selectedCardId"
                :disabled="isCardDisabled(card)"
                @select="select(card)"
              />
              <span class="text-muted-foreground min-h-3 text-xs leading-none italic">
                {{ card.reason && !busy ? card.reason : "" }}
              </span>
            </div>
          </template>
        </div>

        <div
          v-if="selectedCard !== null && groups.length > 0"
          class="flex flex-col gap-2 border-t border-foreground/10 pt-3"
        >
          <div
            v-for="group in groups"
            :key="group.id"
            class="grid grid-flow-col grid-rows-[auto_auto] items-stretch gap-x-3 gap-y-1.5 overflow-x-auto pb-3"
            role="group"
            aria-label="Target"
          >
            <div
              v-for="target in group.cards"
              :key="target.id"
              class="window-card-cell row-span-2 grid w-40 min-w-0 shrink-0 grid-rows-subgrid gap-1.5"
            >
              <RoleCard
                v-if="target.face.kind === 'role'"
                :role="target.face.role"
                selectable
                :selected="isTargetSelected(target)"
                :disabled="busy || !target.enabled"
                @select="toggleTarget(target)"
              />
              <PlayerCard
                v-else-if="target.face.kind === 'player'"
                :seat="target.face.seat"
                :name="target.face.name"
                :image="target.face.image"
                selectable
                :selected="isTargetSelected(target)"
                :disabled="busy || !target.enabled"
                @select="toggleTarget(target)"
              />
              <span class="text-muted-foreground min-h-3 text-xs leading-none italic">
                {{ target.reason ?? "" }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer
      class="flex items-center justify-end gap-2 border-t border-foreground/10 bg-muted/40 px-6 py-3"
    >
      <Button
        type="button"
        size="lg"
        :disabled="busy || !confirmReady"
        :aria-label="confirmLabel"
        @click="confirm"
      >
        Confirm
      </Button>
    </footer>
  </section>
</template>

<style scoped>
/* Pre-subgrid fallback: a browser that drops `grid-rows-subgrid` collapses the shared
   rows, so the cell becomes a flex column and the card takes the slack instead. */
@supports not (grid-template-rows: subgrid) {
  .window-card-cell {
    display: flex;
    flex-direction: column;
  }

  .window-card-cell > :first-child {
    flex: 1;
  }
}
</style>
