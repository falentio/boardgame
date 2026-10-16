<script setup lang="ts">
import DistrictCard from "./DistrictCard.vue";
import type { DistrictId } from "#shared/core/lockstep/games/citadels/index.ts";

defineProps<{ hand: readonly DistrictId[] }>();
</script>

<template>
  <section
    data-slot="citadels-hand"
    class="flex min-h-0 flex-col gap-1.5 rounded-xl bg-muted/20 p-3 ring-1 ring-foreground/10"
  >
    <span
      class="text-[0.625rem] leading-none font-semibold tracking-[0.2em] text-muted-foreground uppercase"
    >
      Your hand ({{ hand.length }})
    </span>
    <ul class="flex flex-wrap gap-1.5">
      <li v-for="(district, index) in hand" :key="`${district}-${index}`">
        <DistrictCard :district="district" />
      </li>
    </ul>
  </section>
</template>
