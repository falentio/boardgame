<script setup lang="ts">
import { computed } from "vue"
import { Coins, Crown } from "@lucide/vue"
import DistrictCard from "./DistrictCard.vue"
import type { SeatPlate } from "@/composables/citadels-board.ts"

const props = defineProps<{ seat: SeatPlate }>()

const mark = computed(() => {
  if (props.seat.owed) return "Owes input"
  return props.seat.active ? "Acting" : null
})
</script>

<template>
  <article
    data-slot="citadels-seat"
    :data-seat="seat.seat"
    :data-gold="seat.gold"
    class="flex min-w-0 flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
    :class="seat.active && 'ring-2 ring-primary/50'"
  >
    <div class="flex min-w-0 items-center gap-2">
      <span class="min-w-0 truncate text-sm leading-tight font-semibold">{{ seat.name }}</span>
      <span
        v-if="seat.kind === 'me'"
        class="shrink-0 text-[0.625rem] leading-none font-medium tracking-wide text-muted-foreground uppercase"
      >You</span>
      <span
        v-if="seat.crown"
        data-slot="citadels-crown"
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.625rem] leading-none font-medium uppercase"
      >
        <Crown class="size-3 text-amber-500" aria-hidden="true" />Crown
      </span>
      <span
        v-if="seat.active"
        data-slot="citadels-active"
        class="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[0.625rem] leading-none font-semibold text-primary-foreground uppercase"
      >Acting</span>
      <span
        class="ms-auto inline-flex shrink-0 items-center gap-1 text-sm leading-none font-semibold tabular-nums"
        :aria-label="`${seat.gold} gold`"
      >
        <Coins class="size-3.5 text-amber-500" aria-hidden="true" />{{ seat.gold }}
      </span>
    </div>

    <p class="text-xs leading-tight text-muted-foreground tabular-nums">
      <template v-if="seat.kind === 'rival'">{{ seat.handCount }} cards in hand</template>
      <template v-else>{{ seat.city.length }} of {{ seat.cityTarget }} districts</template>
      <span v-if="mark"> · {{ mark }}</span>
    </p>

    <ul class="flex flex-wrap gap-1.5">
      <li v-for="(card, index) in seat.city" :key="`${card.id}-${index}`">
        <DistrictCard :district="card.id" :gold="card.gold" />
      </li>
      <li v-if="seat.city.length === 0" class="self-center text-xs italic text-muted-foreground">
        no districts yet
      </li>
    </ul>
  </article>
</template>
