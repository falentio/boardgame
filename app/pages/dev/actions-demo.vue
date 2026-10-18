<script setup lang="ts">
import { ref } from "vue";
import CitadelsActions from "@/components/citadels/board/CitadelsActions.vue";
import type { CitadelsBoard } from "@/composables/citadels-board.ts";
import type { CitadelsAction } from "#shared/core/lockstep/games/citadels/index.ts";

definePageMeta({ layout: false });

const fired = ref<CitadelsAction[]>([]);
const record = (action: CitadelsAction): void => {
  fired.value = [...fired.value, action];
  (window as unknown as { __emitted: CitadelsAction[] }).__emitted = fired.value;
};

const boardWith = (hand: CitadelsBoard["me"]["hand"]): CitadelsBoard =>
  ({
    table: {
      round: 1,
      phase: "turn",
      phaseLabel: "Turn",
      cast: [],
      myPick: null,
      window: { purpose: "turn", label: "Take your turn", owedByMe: true },
      pending: null,
      deckCount: 12,
      discard: [],
      winner: null,
      terminal: false,
    },
    opponents: [],
    seats: [],
    me: {
      seat: "ada",
      name: "Ada",
      kind: "me",
      gold: 2,
      city: [],
      crown: false,
      active: true,
      owed: true,
      hand,
      cityTarget: 8,
    },
  }) as unknown as CitadelsBoard;

const twoCards = boardWith(["tavern", "market"]);
const noCards = boardWith([]);
const otherWindow = {
  ...twoCards,
  table: {
    ...twoCards.table,
    window: { purpose: "keep", label: "Keep a card", owedByMe: true },
    phase: "draft",
  },
} as unknown as CitadelsBoard;
const rivalWindow = {
  ...twoCards,
  table: { ...twoCards.table, window: { purpose: "turn", label: "Take your turn", owedByMe: false } },
} as unknown as CitadelsBoard;
const noWindow = {
  ...twoCards,
  table: { ...twoCards.table, window: null },
} as unknown as CitadelsBoard;
</script>

<template>
  <div class="flex h-dvh flex-col gap-4 bg-monokai-bg p-6 font-mono text-monokai-fg">
    <section data-demo="two-cards" class="flex flex-col gap-1.5">
      <span class="text-[0.625rem] leading-none tracking-[0.2em] text-monokai-comment uppercase"
        >turn window · two cards in hand</span
      >
      <CitadelsActions
        :board="twoCards"
        @gold="record({ t: 'gold' })"
        @draw="record({ t: 'draw' })"
        @build="record({ t: 'build', card: 0 })"
        @pass="record({ t: 'pass' })"
      />
    </section>

    <section data-demo="no-cards" class="flex flex-col gap-1.5">
      <span class="text-[0.625rem] leading-none tracking-[0.2em] text-monokai-comment uppercase"
        >turn window · empty hand</span
      >
      <CitadelsActions
        :board="noCards"
        @gold="record({ t: 'gold' })"
        @draw="record({ t: 'draw' })"
        @build="record({ t: 'build', card: 0 })"
        @pass="record({ t: 'pass' })"
      />
    </section>

    <section data-demo="other-window" class="flex flex-col gap-1.5">
      <span class="text-[0.625rem] leading-none tracking-[0.2em] text-monokai-comment uppercase"
        >keep window · owed by me</span
      >
      <CitadelsActions :board="otherWindow" />
    </section>

    <section data-demo="rival-window" class="flex flex-col gap-1.5">
      <span class="text-[0.625rem] leading-none tracking-[0.2em] text-monokai-comment uppercase"
        >turn window · owed by a rival</span
      >
      <CitadelsActions :board="rivalWindow" />
    </section>

    <section data-demo="no-window" class="flex flex-col gap-1.5">
      <span class="text-[0.625rem] leading-none tracking-[0.2em] text-monokai-comment uppercase"
        >no window open</span
      >
      <CitadelsActions :board="noWindow" />
    </section>

    <pre data-slot="actions-emitted" class="text-[0.625rem] text-monokai-comment">{{
      JSON.stringify(fired)
    }}</pre>
  </div>
</template>
