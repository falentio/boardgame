<script setup lang="ts">
import { computed } from "vue";
import type { CitadelsBoard } from "@/composables/citadels-board.ts";
import DistrictCard from "../DistrictCard.vue";

const props = defineProps<{ board: CitadelsBoard }>();
const emit = defineEmits<{ keep: [index: number] }>();

const open = computed(() => {
  const window = props.board.table.window;
  return window?.owedByMe === true && window.purpose === "keep";
});

/** The reducer keeps pool[action.index], so the surface reports the position it shows. */
const drawn = computed(() => props.board.table.drawn);
</script>

<template>
  <Transition name="citadels-overlay">
    <section
      v-if="open"
      data-slot="citadels-keep"
      aria-label="Keep a card"
      class="absolute inset-0 z-40 flex flex-col gap-3 overflow-y-auto bg-monokai-bg/30 p-4 backdrop-blur-[2px]"
    >
      <header class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-mono text-sm leading-none font-bold tracking-[0.18em] uppercase">
          Keep a card
        </h2>
        <span class="font-mono text-[0.625rem] leading-none tracking-[0.16em] text-monokai-comment uppercase">
          round {{ board.table.round }} · draw {{ drawn.length }}
        </span>
      </header>

      <ul data-slot="citadels-keep-choice" class="flex flex-wrap gap-3">
        <li v-for="(district, index) in drawn" :key="index" class="min-w-0">
          <button
            type="button"
            data-slot="citadels-keep-card"
            :data-index="index"
            :data-district="district"
            :aria-label="`Keep card ${index + 1}`"
            class="block w-40 max-w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-monokai-yellow"
            @click="emit('keep', index)"
          >
            <DistrictCard :district="district" class="h-auto w-full" />
          </button>
        </li>
      </ul>
    </section>
  </Transition>
</template>
