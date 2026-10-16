<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import type { DistrictId, DistrictType } from "#shared/core/lockstep/games/citadels/index.ts";
import { specOfDistrict } from "#shared/core/lockstep/games/citadels/index.ts";
import { cn } from "@/lib/utils";

const props = defineProps<{
  district: DistrictId;
  /** The Artist's beautify marker on a placed district. Absent for a card in hand. */
  gold?: number;
  class?: HTMLAttributes["class"];
}>();

const ACCENT: Readonly<Record<DistrictType, string>> = {
  noble: "var(--district-noble)",
  religious: "var(--district-religious)",
  trade: "var(--district-trade)",
  military: "var(--district-military)",
  unique: "var(--district-unique)",
};

const spec = computed(() => specOfDistrict(props.district));
const accent = computed(() => ACCENT[spec.value.type]);
</script>

<template>
  <span
    data-slot="citadels-district"
    :data-district="spec.id"
    :title="`${spec.name} · ${spec.type} · ${spec.cost} gold`"
    :style="{ '--accent': accent }"
    :class="
      cn(
        'flex w-24 shrink-0 flex-col gap-0.5 rounded-lg bg-card px-2 py-1.5 ring-1 ring-foreground/10',
        props.class,
      )
    "
  >
    <span class="truncate text-xs leading-tight font-medium">{{ spec.name }}</span>
    <span class="flex items-center gap-1 text-[0.625rem] leading-none tabular-nums">
      <span class="truncate capitalize" :style="{ color: accent }">{{ spec.type }}</span>
      <span class="text-muted-foreground">{{ spec.cost }}g</span>
      <span
        v-if="gold"
        data-slot="citadels-beautify"
        class="font-medium text-amber-600 dark:text-amber-400"
        :aria-label="`${gold} gold on this district`"
        >+{{ gold }}</span
      >
    </span>
  </span>
</template>
