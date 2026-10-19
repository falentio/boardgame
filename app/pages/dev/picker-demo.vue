<script setup lang="ts">
import CitadelsPick from "@/components/citadels/board/CitadelsPick.vue";
import { BASE_CAST } from "#shared/core/lockstep/games/citadels/index.ts";
import { specOfCharacter } from "#shared/core/lockstep/games/citadels/index.ts";
import type { CitadelsBoard } from "@/composables/citadels-board.ts";

definePageMeta({ layout: false });

const cast = BASE_CAST.slice(0, 8).map((character, at) => ({
  character,
  name: specOfCharacter(character).name,
  rank: specOfCharacter(character).rank,
  state: (at === 2 ? "faceup" : at === 5 ? "mine" : "available") as "available" | "faceup" | "mine",
}));

/** A live draft where the viewer owes a pick, which is exactly when the picker opens. */
const board = {
  table: {
    round: 2,
    phase: "draft",
    phaseLabel: "Draft",
    cast,
    myPick: null,
    window: { purpose: "draft-pick", label: "Pick a character", owedByMe: true },
    pending: null,
    deckCount: 9,
    discard: ["Tavern"],
    winner: null,
    terminal: false,
  },
  opponents: [],
  seats: [],
  me: {
    seat: "ada",
    name: "Ada",
    kind: "me",
    gold: 4,
    city: [],
    crown: true,
    active: true,
    owed: true,
    hand: [],
    cityTarget: 8,
  },
} as unknown as CitadelsBoard;
</script>

<template>
  <div class="relative h-dvh bg-monokai-bg text-monokai-fg">
    <CitadelsPick :board="board" />
  </div>
</template>