<script setup lang="ts">
import { Coins, Crown, Layers } from "@lucide/vue";
import { DISTRICT_ACCENT } from "@/composables/card-shell";
import { specOfDistrict } from "#shared/core/lockstep/games/citadels/index.ts";
import { defaultAvatarUrl } from "#shared/users/avatar.ts";
import { computed } from "vue";
import type { SeatPlate } from "@/composables/citadels-board.ts";
import "./citadels-skin.css";

const props = defineProps<{ seat: SeatPlate; focused: boolean }>();
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
    :style="{ '--ink': focused ? 'var(--monokai-yellow)' : 'var(--monokai-line)' }"
    :aria-pressed="focused"
    :aria-label="`${seat.name}: ${seat.gold} gold, ${seat.city.length} of 8 districts, ${handCount} in hand`"
    :data-mine="seat.kind === 'me' ? '' : undefined"
    type="button"
    class="citadels-piece citadels-piece--thick citadels-piece--still flex w-full flex-col gap-1 p-1.5 text-left"
    @click="emit('focus')"
  >
    <span class="flex items-center gap-1.5">
      <span
        data-slot="citadels-seat-emblem"
        class="flex size-8 shrink-0 items-center justify-center overflow-hidden bg-monokai-bg"
      >
        <img :src="pfp" alt="" class="size-7 object-cover" />
      </span>
      <span class="flex min-w-0 flex-1 flex-col gap-1">
        <span class="min-w-0 text-[0.6875rem] leading-none font-bold text-monokai-fg [overflow-wrap:anywhere]">{{
          seat.name
        }}</span>
        <span class="flex min-w-0 items-center gap-1">
          <span
            v-if="seat.crown"
            data-slot="citadels-crown"
            class="citadels-plate flex size-3.5 shrink-0 items-center justify-center"
          >
            <Crown class="size-2" aria-hidden="true" />
          </span>
          <span
            v-if="seat.kind === 'me'"
            data-slot="citadels-you"
            class="citadels-label !text-[0.5rem]"
            >you</span
          >
          <span
            v-if="seat.active"
            data-slot="citadels-active"
            class="citadels-label !text-[0.5rem] !text-monokai-green"
            >turn</span
          >
          <span
            v-else-if="seat.owed"
            data-slot="citadels-owed"
            class="citadels-label !text-[0.5rem] !text-monokai-pink"
            >owes</span
          >
        </span>
      </span>
    </span>

    <span class="flex items-stretch gap-1">
      <span
        data-slot="citadels-seat-gold"
        class="citadels-piece citadels-piece--plate flex flex-1 items-center justify-between px-1 py-0.5"
      >
        <Coins class="size-2.5 text-monokai-yellow" aria-hidden="true" />
        <span class="citadels-ink text-[0.6875rem] leading-none font-bold">{{ seat.gold }}</span>
      </span>
      <span
        data-slot="citadels-seat-city"
        class="citadels-piece citadels-piece--plate flex flex-1 items-center justify-between px-1 py-0.5"
      >
        <span class="citadels-label !text-[0.5rem]">dist</span>
        <span
          class="text-[0.6875rem] leading-none font-bold tabular-nums"
          :class="near ? 'text-monokai-green' : 'text-monokai-fg'"
          >{{ seat.city.length }}<span class="text-monokai-comment">/8</span></span
        >
      </span>
      <span
        data-slot="citadels-seat-hand"
        class="citadels-piece citadels-piece--plate flex flex-1 items-center justify-between px-1 py-0.5"
      >
        <Layers class="size-2.5 shrink-0 text-monokai-comment" aria-hidden="true" />
        <span class="citadels-ink text-[0.6875rem] leading-none font-bold">{{ handCount }}</span>
      </span>
    </span>

    <span class="flex h-1 w-full gap-px" aria-hidden="true">
      <span
        v-for="(pip, index) in pips"
        :key="index"
        class="flex-1"
        :style="{ background: pip === null ? 'var(--color-monokai-line)' : ink(pip.id) }"
      />
    </span>
  </button>
</template>
