<script setup lang="ts">
import { computed } from "vue";
import { Coins, Flag, Hand, Plus } from "@lucide/vue";
import type { CitadelsBoard } from "@/composables/citadels-board.ts";

const props = defineProps<{ board: CitadelsBoard }>();
const emit = defineEmits<{
  gold: [];
  draw: [];
  build: [];
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
  { action: "gold", label: "Take 2 gold", icon: Coins },
  { action: "draw", label: "Draw 2 cards", icon: Hand },
  { action: "build", label: "Build", icon: Plus },
  { action: "pass", label: "Pass", icon: Flag },
] as const;
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
        class="inline-flex items-center gap-1.5 border border-monokai-line bg-monokai-panel px-2.5 py-1.5 font-mono text-[0.625rem] leading-none font-bold tracking-[0.16em] text-monokai-fg uppercase hover:border-monokai-yellow hover:text-monokai-yellow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-monokai-yellow disabled:cursor-not-allowed disabled:border-monokai-line disabled:text-monokai-comment disabled:hover:border-monokai-line disabled:hover:text-monokai-comment"
        @click="emit(choice.action)"
      >
        <component
          :is="choice.icon"
          v-if="choice.icon"
          class="size-3.5 shrink-0"
          aria-hidden="true"
        />
        <span>{{ choice.label }}</span>
      </button>
    </li>
  </ul>
</template>
