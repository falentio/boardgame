<script setup lang="ts">
import { computed } from "vue";
import { Coins, Flag, Hand, Plus } from "@lucide/vue";
import type { CitadelsBoard } from "@/composables/citadels-board.ts";

const props = defineProps<{ board: CitadelsBoard }>();
const emit = defineEmits<{
  gold: [];
  draw: [];
  build: [card: number];
  pass: [];
}>();

/** The four choices exist only on the turn window's gather, before the gather lands. */
const open = computed(
  () => props.board.table.window?.owedByMe === true && props.board.table.window.purpose === "turn",
);

const hand = computed(() => props.board.me.hand.length);

/**
 * Every turn window is the turn's gather, and the reducer takes all four reports
 * there: pass and an unaffordable build close the turn, gold and draw land the
 * gather and open the build window below it. Only build needs a card, because
 * `tryBuild` reads one out of the hand by index.
 */
const buildable = computed(() => hand.value > 0);

const CHOICES = [
  { action: "gold", label: "Gold", count: "2", icon: Coins },
  { action: "draw", label: "Cards", count: "2", icon: Hand },
  { action: "build", label: "Build", count: null, icon: Plus },
  { action: "pass", label: "Pass", count: null, icon: Flag },
] as const;

type Choice = (typeof CHOICES)[number]["action"];

/** No card picker stands beside the tile, so a build reports the hand's first card. */
const FIRST_CARD = 0;

const choose = (action: Choice): void => {
  switch (action) {
    case "gold":
      emit("gold");
      return;
    case "draw":
      emit("draw");
      return;
    case "build":
      emit("build", FIRST_CARD);
      return;
    case "pass":
      emit("pass");
  }
};
</script>

<template>
  <ul
    v-if="open"
    data-slot="citadels-actions"
    aria-label="Turn actions"
    class="flex flex-wrap gap-1.5"
  >
    <li v-for="choice in CHOICES" :key="choice.action">
      <button
        type="button"
        data-slot="citadels-action"
        :data-action="choice.action"
        :disabled="choice.action === 'build' && !buildable"
        :title="choice.action === 'build' && !buildable ? 'Your hand is empty, so there is nothing to build' : undefined"
        class="flex items-center gap-1.5 border border-monokai-line bg-monokai-panel px-2 py-1.5 font-mono text-[0.625rem] leading-none font-bold tracking-[0.16em] text-monokai-fg uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-monokai-yellow disabled:cursor-not-allowed disabled:border-monokai-line disabled:text-monokai-comment"
        @click="choose(choice.action)"
      >
        <component :is="choice.icon" class="size-3.5 shrink-0" aria-hidden="true" />
        <span>{{ choice.label }}</span>
        <span
          v-if="choice.count !== null"
          class="border border-monokai-yellow bg-monokai-yellow px-1 py-0.5 text-[0.625rem] leading-none font-bold text-monokai-bg tabular-nums"
          >{{ choice.count }}</span
        >
      </button>
    </li>
  </ul>
</template>

<style scoped>
/* Tailwind's hover variant sits behind (hover: hover), which a touch screen and a
   headless browser both refuse; the tile answers a hover wherever the pointer is. */
[data-slot="citadels-action"] {
  transition:
    border-color 150ms ease,
    color 150ms ease,
    translate 150ms ease,
    scale 120ms var(--ease-out);
}

[data-slot="citadels-action"]:hover:not(:disabled) {
  border-color: var(--monokai-yellow);
  color: var(--monokai-yellow);
}

@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  [data-slot="citadels-action"]:hover:not(:disabled) {
    translate: 0 -1px;
  }
}

@media (prefers-reduced-motion: no-preference) {
  [data-slot="citadels-action"]:active:not(:disabled) {
    scale: 0.97;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-slot="citadels-action"] {
    transition-property: border-color, color;
  }
}
</style>
