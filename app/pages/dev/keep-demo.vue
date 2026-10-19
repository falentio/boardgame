<script setup lang="ts">
import { computed, ref } from "vue";
import CitadelsKeep from "@/components/citadels/board/CitadelsKeep.vue";
import { citadelsBoardOf } from "@/composables/citadels-board.ts";
import {
  BASE_CAST,
  BASIC_DISTRICTS,
  citadels,
  type CitadelsView,
} from "#shared/core/lockstep/games/citadels/index.ts";
import { genesisSeed, makeRandom, makeRoster } from "#shared/core/lockstep/index.ts";
import { seatId } from "#shared/rooms/ids.ts";

definePageMeta({ layout: false });

const ANN = seatId("ann");
const BOB = seatId("bob");
const NAMES = new Map([
  [ANN, "Ada"],
  [BOB, "Bo"],
]);

const base = citadels.project(
  citadels.genesis(
    { cast: [...BASE_CAST] },
    makeRoster([ANN, BOB]),
    makeRandom(genesisSeed("keep-demo")),
  ),
  ANN,
);

/** The engine's own view, moved onto the gather keep the surface renders. */
const staged = (): CitadelsView => {
  const drawn = BASIC_DISTRICTS.slice(0, 2).map((district) => district.id);
  return {
    ...base,
    phase: "turn",
    owedSeats: [ANN],
    myHand: [...base.myHand, ...drawn],
    myDraw: drawn,
    window: { kind: "oneOf", purpose: "keep" },
    pending: { actor: ANN, character: null, target: null, cards: drawn.length },
  };
};

const board = computed(() => citadelsBoardOf(staged(), NAMES));
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
