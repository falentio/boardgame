<script setup lang="ts">
import { computed } from "vue";
import { Coins, Crown } from "@lucide/vue";
import type { OpponentSeat, CityCard } from "@/composables/citadels-board.ts";
import { DISTRICT_ACCENT } from "@/composables/card-shell";
import { specOfDistrict } from "#shared/core/lockstep/games/citadels/index.ts";

const props = defineProps<{ rival: OpponentSeat; focused: boolean }>();
const emit = defineEmits<{ focus: [] }>();

const cityLine = computed(() => `${props.rival.city.length} of 8 districts`);
const barOf = (card: CityCard): readonly [string, string] => {
  const type = specOfDistrict(card.id).type;
  return [DISTRICT_ACCENT[type], card.gold > 0 ? "opacity-100" : "opacity-70"];
};
const gaps = computed(() => Array.from({ length: Math.max(0, 8 - props.rival.city.length) }));
const reach = computed(() => props.rival.city.length >= 7);
</script>

<template>
  <button
    data-slot="citadels-seat"
    :data-seat="rival.seat"
    :data-gold="rival.gold"
    :aria-pressed="focused"
    :aria-label="`Show ${rival.name}'s board`"
    type="button"
    class="flex w-full flex-col gap-1.5 rounded-xl bg-card p-2.5 text-left ring-1 transition-colors ring-foreground/10 hover:ring-foreground/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    :class="[
      focused && 'ring-2 ring-primary',
      rival.active && !focused && 'ring-2 ring-primary/50',
      reach && !focused && !rival.active && 'ring-foreground/20',
    ]"
    @click="emit('focus')"
  >
    <span class="flex min-w-0 items-center gap-1.5">
      <span class="min-w-0 truncate text-sm leading-tight font-semibold">{{ rival.name }}</span>
      <span
        v-if="rival.crown"
        data-slot="citadels-crown"
        class="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[0.625rem] leading-none font-medium uppercase"
      >
        <Crown class="size-3" aria-hidden="true" />Crown
      </span>
      <span
        v-if="rival.active"
        data-slot="citadels-active"
        class="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[0.625rem] leading-none font-semibold text-primary-foreground uppercase"
        >Acting</span
      >
      <span
        class="ms-auto inline-flex shrink-0 items-center gap-1 text-sm leading-none font-semibold tabular-nums"
        :aria-label="`${rival.gold} gold`"
      >
        <Coins class="size-3.5 text-amber-500" aria-hidden="true" />{{ rival.gold }}
      </span>
    </span>

    <span class="text-xs leading-tight text-muted-foreground tabular-nums">
      {{ cityLine }} · {{ rival.handCount }} in hand
    </span>

    <span class="flex gap-0.5" aria-hidden="true">
      <span
        v-for="(card, index) in rival.city"
        :key="`${card.id}-${index}`"
        class="h-1.5 flex-1 rounded-full"
        :class="barOf(card)[1]"
        :style="{ backgroundColor: barOf(card)[0] }"
      />
      <span v-for="n in gaps" :key="`gap-${n}`" class="h-1.5 flex-1 rounded-full bg-muted" />
    </span>

    <span v-if="rival.owed" data-slot="citadels-owed" class="text-[0.6875rem] leading-none font-medium text-primary">
      Owes input
    </span>
  </button>
</template>
