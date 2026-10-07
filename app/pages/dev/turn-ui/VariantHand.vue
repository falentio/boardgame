<script setup lang="ts">
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type { MenuSeatChoice, WindowMenu } from "@/composables/window-menu.ts"
import { useTurnCards, type TurnFaceOption } from "./useTurnCards.ts"
import TurnCard from "./TurnCard.vue"

const props = defineProps<{ menu: WindowMenu; busy?: boolean }>()
const emit = defineEmits<{ act: [action: G54Action] }>()

const cards = useTurnCards(
  () => props.menu,
  () => props.busy,
  (action) => emit("act", action),
)

const onPick = (option: TurnFaceOption, choice: MenuSeatChoice): void => {
  if (option.kind !== "target") return
  cards.pick(option, choice)
}
</script>

<template>
  <div class="flex flex-col gap-3" data-slot="variant-hand">
    <h2 class="text-sm leading-tight font-semibold">
      {{ menu.title }}
    </h2>
    <p v-if="menu.note" class="text-muted-foreground text-xs leading-snug">
      {{ menu.note }}
    </p>

    <div class="flex items-stretch gap-3 overflow-x-auto pb-3">
      <TurnCard
        v-for="option in cards.general.value"
        :key="option.id"
        :option="option"
        :busy="busy"
        :selected="cards.openId.value === option.id"
        fill
        class="w-40 shrink-0"
        @choose="cards.choose(option)"
        @pick="onPick(option, $event)"
      />

      <div class="mx-1 w-px shrink-0 self-stretch bg-foreground/15" aria-hidden="true" />

      <TurnCard
        v-for="option in cards.roles.value"
        :key="option.id"
        :option="option"
        :busy="busy"
        :selected="cards.openId.value === option.id"
        fill
        class="w-40 shrink-0"
        @choose="cards.choose(option)"
        @pick="onPick(option, $event)"
      />
    </div>
  </div>
</template>
