<script setup lang="ts">
import { Coins, Crown, Layers } from "@lucide/vue";
import { DISTRICT_ACCENT } from "@/composables/card-shell";
import { specOfDistrict } from "#shared/core/lockstep/games/citadels/index.ts";
import { defaultAvatarUrl } from "#shared/users/avatar.ts";
import { computed } from "vue";
import type { TableSeat } from "@/composables/citadels-board.ts";

const props = defineProps<{ seat: TableSeat; focused: boolean }>();
const emit = defineEmits<{ focus: [] }>();

const handCount = computed(() => (props.seat.kind === "me" ? props.seat.hand.length : props.seat.handCount));
const pips = Array.from({ length: 8 }, (_, i) => props.seat.city[i] ?? null);
const ink = (id: string): string => DISTRICT_ACCENT[specOfDistrict(id).type];
const near = props.seat.city.length >= 7;
const pfp = defaultAvatarUrl(props.seat.seat);
</script>

<template>
  <button
    data-slot="citadels-seat"
    :data-seat="seat.seat"
    :data-gold="seat.gold"
    :aria-pressed="focused"
    :aria-label="`${seat.name}: ${seat.gold} gold, ${seat.city.length} of 8 districts, ${handCount} in hand`"
    :data-mine="seat.kind === 'me' ? '' : undefined"
    type="button"
    class="grid w-full grid-cols-[auto_1fr_auto] items-start gap-x-2 border p-1.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-monokai-yellow"
    :class="focused ? 'border-monokai-yellow' : 'border-monokai-line hover:border-monokai-comment'"
    @click="emit('focus')"
  >
    <span class="relative size-9 shrink-0 border border-monokai-line bg-monokai-panel">
      <img :src="pfp" alt="" class="size-full object-cover" />
      <span
        v-if="seat.crown"
        data-slot="citadels-crown"
        class="absolute -top-px -end-px border border-monokai-bg bg-monokai-yellow p-px text-monokai-bg"
      >
        <Crown class="size-2" aria-hidden="true" />
      </span>
    </span>
    <span class="col-span-2 flex min-w-0 items-baseline gap-1.5">
      <span class="truncate text-xs font-semibold text-monokai-fg">{{ seat.name }}</span>
      <span v-if="seat.kind === 'me'" data-slot="citadels-you" class="shrink-0 font-mono text-[0.5rem] font-bold text-monokai-comment uppercase"
        >you</span
      >
      <span
        v-if="seat.active"
        data-slot="citadels-active"
        class="shrink-0 font-mono text-[0.5rem] font-bold text-monokai-green uppercase"
        >turn</span
      >
      <span v-else-if="seat.owed" data-slot="citadels-owed" class="shrink-0 font-mono text-[0.5rem] font-bold text-monokai-pink uppercase"
        >owes</span
      >
      <span class="ms-auto flex shrink-0 items-center gap-0.5 font-mono text-xs font-bold tabular-nums text-monokai-yellow">
        <Coins class="size-3" aria-hidden="true" />{{ seat.gold }}
      </span>
    </span>
    <span
      class="flex items-center font-mono text-[0.5625rem] leading-none tabular-nums"
      :class="near ? 'text-monokai-green' : 'text-monokai-fg'"
      >{{ seat.city.length }}<span class="text-monokai-comment">/8</span></span
    >
    <span />
    <span class="flex items-center justify-end gap-1 font-mono text-[0.5625rem] leading-none tabular-nums text-monokai-comment">
      <Layers class="size-2.5 shrink-0" aria-hidden="true" />{{ handCount }}
    </span>
    <span class="col-span-3 mt-1 flex h-1 w-full" aria-hidden="true">
      <span
        v-for="(pip, index) in pips"
        :key="index"
        class="flex-1"
        :style="{ background: pip === null ? 'var(--color-monokai-line)' : ink(pip.id) }"
      />
    </span>
  </button>
</template>
