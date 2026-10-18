<script setup lang="ts">
import { ref } from "vue";
import CitadelsKeep from "@/components/citadels/board/CitadelsKeep.vue";
import type { CitadelsBoard } from "@/composables/citadels-board.ts";
import type { DistrictId } from "#shared/core/lockstep/games/citadels/index.ts";

definePageMeta({ layout: false });

const board = {
  table: {
    round: 3,
    phase: "turn",
    phaseLabel: "Turn",
    cast: [],
    myPick: null,
    window: { purpose: "keep", label: "Keep a card", owedByMe: true },
    pending: { actor: "ada", character: null, target: null, cards: 2 },
    drawn: ["haunted-quarter", "school-of-magic"] as readonly DistrictId[],
    deckCount: 41,
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
    gold: 6,
    city: [],
    crown: true,
    active: true,
    owed: true,
    hand: ["tavern", "docks"] as readonly DistrictId[],
    cityTarget: 8,
  },
} as unknown as CitadelsBoard;

const kept = ref<number | null>(null);
</script>

<template>
  <div class="relative h-dvh bg-monokai-bg p-3 text-monokai-fg">
    <p data-slot="keep-demo-log" class="font-mono text-[0.625rem] tracking-[0.16em] text-monokai-comment uppercase">
      keep {{ kept === null ? "none" : kept }}
    </p>
    <CitadelsKeep :board="board" @keep="(index) => (kept = index)" />
  </div>
</template>
