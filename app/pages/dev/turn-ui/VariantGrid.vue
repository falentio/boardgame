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

const ordered = (): readonly TurnFaceOption[] => [...cards.general.value, ...cards.roles.value]

const onPick = (option: TurnFaceOption, choice: MenuSeatChoice): void => {
  if (option.kind !== "target") return
  cards.pick(option, choice)
}
</script>

<template>
  <div class="flex flex-col gap-3" data-slot="variant-grid">
    <h2 class="text-sm leading-tight font-semibold">
      {{ menu.title }}
    </h2>
    <p v-if="menu.note" class="text-muted-foreground text-xs leading-snug">
      {{ menu.note }}
    </p>

    <ul class="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 min-[720px]:grid-cols-4">
      <li v-for="option in ordered()" :key="option.id" class="flex min-w-0">
        <TurnCard
          :option="option"
          :busy="busy"
          :selected="cards.openId.value === option.id"
          class="w-full"
          @choose="cards.choose(option)"
          @pick="onPick(option, $event)"
        />
      </li>
    </ul>
  </div>
</template>
