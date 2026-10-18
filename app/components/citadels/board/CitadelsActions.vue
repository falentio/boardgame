<script setup lang="ts">
import { computed } from "vue";
import { Coins, Flag, Hand, Plus } from "@lucide/vue";
import type { CitadelsAction } from "#shared/core/lockstep/games/citadels/index.ts";
import type { CitadelsBoard } from "@/composables/citadels-board.ts";

const props = defineProps<{
  board: CitadelsBoard;
  /** The hand index the viewer picked, or null while the hand has no card picked. */
  card?: number | null;
}>();
const emit = defineEmits<{ action: [action: CitadelsAction] }>();

/** The four choices exist only on the turn window's gather, before the gather lands. */
const open = computed(
  () => props.board.table.window?.owedByMe === true && props.board.table.window.purpose === "turn",
);

const hand = computed(() => props.board.me.hand.length);
const picked = computed(() => props.card ?? null);

/**
 * Every turn window is the turn's gather, and the reducer takes all four reports
 * there: pass and an unaffordable build close the turn, gold and draw land the
 * gather and open the build window below it. Build needs a card, and the only
 * card it may name is the one the hand reported, because `tryBuild` reads a hand
 * index and the hand is what knows which index a card sits at.
 */
const buildable = computed(() => hand.value > 0 && picked.value !== null);

const CHOICES = [
  { action: "gold", label: "Gold", count: "2", icon: Coins },
  { action: "draw", label: "Cards", count: "2", icon: Hand },
  { action: "build", label: "Build", count: null, icon: Plus },
  { action: "pass", label: "Pass", count: null, icon: Flag },
] as const;

type Choice = (typeof CHOICES)[number]["action"];

const title = (action: Choice): string | undefined =>
  action !== "build" || buildable.value
    ? undefined
    : hand.value === 0
      ? "Your hand is empty, so there is nothing to build"
      : "Pick a card in your hand, then build it";

const choose = (action: Choice): void => {
  switch (action) {
    case "gold":
      emit("action", { t: "gold" });
      return;
    case "draw":
      emit("action", { t: "draw" });
      return;
    case "build": {
      const card = picked.value;
      if (card === null) return;
      emit("action", { t: "build", card });
      return;
    }
    case "pass":
      emit("action", { t: "pass" });
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
        :title="title(choice.action)"
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
    border-color var(--dur-ink) ease,
    color var(--dur-ink) ease,
    translate var(--dur-ink) ease,
    scale var(--dur-press) var(--ease-out);
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
