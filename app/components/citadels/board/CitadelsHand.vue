<script setup lang="ts">
import type { DistrictId } from "#shared/core/lockstep/games/citadels/index.ts";
import DistrictCard from "../DistrictCard.vue";

defineProps<{ hand: readonly DistrictId[]; disabled?: boolean }>();
const emit = defineEmits<{ build: [district: DistrictId] }>();
</script>

<template>
  <section data-slot="citadels-hand" class="flex flex-col gap-1.5">
    <span
      class="text-[0.625rem] leading-none font-semibold tracking-[0.2em] text-muted-foreground uppercase"
    >
      Your hand ({{ hand.length }})
    </span>
    <ul class="flex flex-wrap gap-1.5">
      <li v-for="(district, index) in hand" :key="`${district}-${index}`">
        <button
          type="button"
          class="block focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed"
          :disabled="disabled"
          :aria-label="`Build ${district}`"
          @click="emit('build', district)"
        >
          <DistrictCard :district="district" class="hover:ring-foreground/30" />
        </button>
      </li>
      <li
        v-if="hand.length === 0"
        class="self-center text-xs leading-tight text-muted-foreground italic"
      >
        no cards in hand
      </li>
    </ul>
  </section>
</template>
