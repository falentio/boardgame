<script setup lang="ts">
import { type DistrictId, specOfDistrict } from "#shared/core/lockstep/games/citadels/index.ts";
import DistrictCard from "../DistrictCard.vue";

defineProps<{
  hand: readonly DistrictId[];
  /** The hand index the turn bar would build right now, or null when nothing is picked. */
  picked?: number | null;
  pickable?: boolean;
}>();
const emit = defineEmits<{ pick: [card: number] }>();
</script>

<template>
  <section data-slot="citadels-hand" class="flex flex-col gap-1.5">
    <span
      class="text-[0.625rem] leading-none font-semibold tracking-[0.2em] text-monokai-comment uppercase"
    >
      Your hand ({{ hand.length }})
    </span>
    <ul class="flex flex-wrap gap-1.5">
      <li v-for="(district, index) in hand" :key="`${district}-${index}`">
        <button
          type="button"
          data-slot="citadels-hand-tile"
          :data-index="index"
          :data-picked="picked === index ? 'true' : undefined"
          :aria-pressed="picked === index"
          :aria-label="`Build ${specOfDistrict(district).name} from hand`"
          class="block disabled:cursor-not-allowed"
          :disabled="pickable !== true"
          @click="emit('pick', index)"
        >
          <DistrictCard :district="district" />
        </button>
      </li>
      <li
        v-if="hand.length === 0"
        class="self-center text-xs leading-tight text-monokai-comment italic"
      >
        no cards in hand
      </li>
    </ul>
  </section>
</template>

<style scoped>
/* The card carries its own frame, so the tile inks the edge just outside it. */
[data-slot="citadels-hand-tile"] {
  outline: 1px solid transparent;
  outline-offset: 1px;
  transition:
    outline-color var(--dur-ink) ease,
    translate var(--dur-ink) ease;
}

[data-slot="citadels-hand-tile"]:hover:not(:disabled) {
  outline-color: var(--monokai-yellow);
}

[data-slot="citadels-hand-tile"]:focus-visible {
  outline-width: 2px;
  outline-offset: 2px;
  outline-color: var(--monokai-yellow);
}

[data-slot="citadels-hand-tile"][data-picked="true"] {
  outline-width: 2px;
  outline-color: var(--monokai-yellow);
}

@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  [data-slot="citadels-hand-tile"]:hover:not(:disabled) {
    translate: 0 -1px;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-slot="citadels-hand-tile"] {
    transition-property: outline-color;
  }
}
</style>
