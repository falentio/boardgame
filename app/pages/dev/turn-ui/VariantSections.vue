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
  <div class="flex flex-col gap-5" data-slot="variant-sections">
    <h2 class="text-sm leading-tight font-semibold">
      {{ menu.title }}
    </h2>

    <section class="flex flex-col gap-3">
      <h3 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        General actions
      </h3>
      <ul class="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 min-[720px]:grid-cols-4">
        <li v-for="option in cards.general.value" :key="option.id" class="flex min-w-0">
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
    </section>

    <section class="flex flex-col gap-3">
      <h3 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        Claim a role
      </h3>
      <ul class="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 min-[720px]:grid-cols-4">
        <li v-for="option in cards.roles.value" :key="option.id" class="flex min-w-0">
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
    </section>
  </div>
</template>
