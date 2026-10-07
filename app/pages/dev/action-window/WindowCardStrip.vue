<script setup lang="ts">
import type { WindowMenu } from "@/composables/window-menu.ts"
import type { WindowSelection } from "./useWindowSelection.ts"
import RoleCard from "@/components/g54/RoleCard.vue"
import GeneralActionCard from "@/components/g54/GeneralActionCard.vue"
import PlayerCard from "@/components/g54/PlayerCard.vue"

const props = defineProps<{
  menu: WindowMenu
  busy?: boolean
  selection: WindowSelection
}>()

const {
  selectedCardId,
  selectedCard,
  groups,
  isCardDisabled,
  startsGroup,
  isTargetSelected,
  select,
  toggleTarget,
} = props.selection
</script>

<template>
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
            :disabled="busy === true || !target.enabled"
            @select="toggleTarget(target)"
          />
          <PlayerCard
            v-else-if="target.face.kind === 'player'"
            :seat="target.face.seat"
            :name="target.face.name"
            :image="target.face.image"
            selectable
            :selected="isTargetSelected(target)"
            :disabled="busy === true || !target.enabled"
            @select="toggleTarget(target)"
          />
          <span class="text-muted-foreground min-h-3 text-xs leading-none italic">
            {{ target.reason ?? "" }}
          </span>
        </div>
      </div>
    </div>
  </div>
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
