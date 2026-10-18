<script setup lang="ts">
import CitadelsBoard from "@/components/citadels/board/CitadelsBoard.vue";
import type { CitadelsBoard as Board } from "@/composables/citadels-board.ts";
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts";

definePageMeta({ layout: false });

const CITY: readonly { readonly id: string; readonly gold: number }[] = [
  { id: "manor", gold: 0 },
  { id: "tavern", gold: 0 },
  { id: "castle", gold: 0 },
];

const table = {
  round: 4,
  phase: "turn",
  phaseLabel: "Turn",
  cast: [
    { character: "assassin", name: "Assassin", rank: 1, state: "mine" },
    { character: "thief", name: "Thief", rank: 2, state: "pending" },
    { character: "magician", name: "Magician", rank: 3, state: "faceup" },
    { character: "king", name: "King", rank: 4, state: "available" },
    { character: "bishop", name: "Bishop", rank: 5, state: "available" },
    { character: "merchant", name: "Merchant", rank: 6, state: "available" },
    { character: "architect", name: "Architect", rank: 7, state: "available" },
    { character: "warlord", name: "Warlord", rank: 8, state: "available" },
  ],
  myPick: null,
  window: { purpose: "turn", label: "Take your turn", owedByMe: true },
  pending: {
    actor: "bolt",
    actorName: "Bolt",
    character: "thief",
    characterName: "Thief",
    target: "cora",
    targetName: "Cora",
    cards: 2,
  },
  deckCount: 23,
  discard: ["prison", "fortress"],
  winner: null,
  terminal: false,
};

const seats = [
  { seat: "ada", name: "Ada", kind: "me", gold: 7, city: CITY, crown: false, active: false, owed: false, hand: ["watchtower", "palace", "church"], cityTarget: 8 },
  { seat: "bolt", name: "Bolt", kind: "rival", gold: 11, city: ["watchtower", "manor", "palace", "tavern"].map((id) => ({ id, gold: 0 })), crown: true, active: true, owed: false, handCount: 2 },
  { seat: "cora", name: "Cora", kind: "rival", gold: 5, city: ["church", "barracks", "castle"].map((id) => ({ id, gold: 0 })), crown: false, active: false, owed: true, handCount: 4 },
  { seat: "dune", name: "Dune", kind: "rival", gold: 0, city: ["temple", "watchtower", "manor", "palace", "tavern", "church", "barracks"].map((id) => ({ id, gold: 0 })), crown: false, active: false, owed: false, handCount: 1 },
];

const board = {
  table,
  opponents: seats.slice(1),
  seats,
  me: seats[0],
} as unknown as Board;

const pick = (character: CharacterId): void => {
  console.info("skin harness pick", character);
};
</script>

<template>
  <section
    data-slot="citadels-surface"
    data-orientation="landscape"
    data-phase="turn"
    class="dark group/surface fixed inset-0 z-50 flex h-dvh min-h-0 flex-col bg-monokai-bg text-monokai-fg"
  >
    <header class="flex shrink-0 items-center gap-3 border-b border-foreground/10 px-3 py-2">
      <span data-slot="citadels-phase" class="text-sm leading-none font-semibold tabular-nums">
        Round {{ board.table.round }} · {{ board.table.phaseLabel }}
      </span>
      <button
        data-slot="citadels-exit"
        type="button"
        class="citadels-piece citadels-piece--plate ms-auto px-2 py-1 font-mono text-[0.5rem] tracking-[0.14em] uppercase"
      >
        Exit
      </button>
    </header>
    <CitadelsBoard :board="board" @pick="pick" />
  </section>
</template>
