<script setup lang="ts">
import { computed, ref } from "vue";
import CitadelsBoard from "@/components/citadels/board/CitadelsBoard.vue";
import { citadelsBoardOf, type CitadelsBoard as Board } from "@/composables/citadels-board.ts";
import {
  BASE_CAST,
  citadels,
  specOfDistrict,
  type CharacterId,
  type CitadelsAction,
  type CitadelsState,
} from "#shared/core/lockstep/games/citadels/index.ts";
import {
  act,
  frameIndex,
  genesisSeed,
  makeRandom,
  makeRoster,
  type SeatId,
} from "#shared/core/lockstep/index.ts";
import { seatId } from "#shared/rooms/ids.ts";
import type { WindowPurpose } from "#shared/core/lockstep/games/citadels/state.ts";

definePageMeta({ layout: false });

const ANN = seatId("ann");
const BOB = seatId("bob");
const CARA = seatId("cara");
const DAN = seatId("dune");
const SEATS: readonly SeatId[] = [ANN, BOB, CARA, DAN];
const SEED = genesisSeed("citadels-interface");
const NAMES: ReadonlyMap<SeatId, string> = new Map([
  [ANN, "Ada"],
  [BOB, "Bolt"],
  [CARA, "Cora"],
  [DAN, "Dune"],
]);

type Decide = (seat: SeatId, state: CitadelsState) => CitadelsAction | null;

/** The always-legal policy the engine's own tests fold with (driver.ts:autoAction). */
const policy: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  const purpose = view.window?.purpose;
  if (purpose === "turn") {
    const me = view.players.find((player) => player.seat === seat);
    const inCity = new Set((me?.city ?? []).map((district) => district.id));
    const purse = me?.gold ?? 0;
    const buildable = view.myHand
      .map((id, index) => ({ id, index }))
      .filter(({ id }) => !inCity.has(id) && specOfDistrict(id).cost <= purse)
      .sort((a, b) => specOfDistrict(a.id).cost - specOfDistrict(b.id).cost)[0];
    if (buildable !== undefined && (me?.city.length ?? 0) < 8) {
      return { t: "build", card: buildable.index };
    }
    return { t: "gold" };
  }
  if (purpose === "keep") return { t: "keep", index: 0 };
  if (purpose === "draft-pick") {
    const pick = view.cast[0];
    return pick === undefined ? null : { t: "pick", character: pick };
  }
  return null;
};

const advance = (state: CitadelsState): CitadelsState =>
  citadels.step(
    state,
    {
      index: frameIndex(0),
      seed: SEED,
      inputs: citadels.seatsOwed(state, frameIndex(0)).map((seat) => {
        const action = policy(seat, state);
        return [seat, action === null ? { kind: "idle" } : act<CitadelsAction>(action)];
      }),
    },
    makeRandom(SEED),
  );

const openPurpose = (state: CitadelsState): WindowPurpose | null => {
  const top = state.steps[0];
  return top !== undefined && top.kind === "window" ? top.window.purpose : null;
};

/** The deal the engine opened with: the draft, where a row reads faceup or available. */
const deal = citadels.genesis({ cast: [...BASE_CAST] }, makeRoster(SEATS), makeRandom(SEED));

/**
 * Fold real frames until the viewer holds a turn window on a table with cities on
 * it, so the face pass reads a played board: a row reads mine or pending, a seat
 * plate reads a grown city.
 */
const turnState = (() => {
  let state = deal;
  let firstTurn: CitadelsState | null = null;
  for (let frames = 0; frames < 4000; frames += 1) {
    const mine = citadels.project(state, ANN);
    if (openPurpose(state) === "turn" && mine.owedSeats.includes(ANN)) {
      if (firstTurn === null) firstTurn = state;
      const grown = mine.players.some((player) => player.city.length >= 3);
      if (mine.round >= 1 && grown) return state;
    }
    state = advance(state);
  }
  if (firstTurn !== null) return firstTurn;
  throw new Error("the engine reached no turn window owed by the viewer seat");
})();

const showing = ref<"turn" | "draft">("turn");
const board = computed<Board>(() =>
  citadelsBoardOf(citadels.project(showing.value === "turn" ? turnState : deal, ANN), NAMES),
);

const pick = (character: CharacterId): void => {
  console.info("skin harness pick", character);
};
</script>

<template>
  <section
    data-slot="citadels-surface"
    data-orientation="landscape"
    :data-phase="board.table.phase"
    class="dark group/surface fixed inset-0 z-50 flex h-dvh min-h-0 flex-col bg-monokai-bg text-monokai-fg"
  >
    <header class="flex shrink-0 items-center gap-3 border-b border-foreground/10 px-3 py-2">
      <span data-slot="citadels-phase" class="text-sm leading-none font-semibold tabular-nums">
        Round {{ board.table.round }} · {{ board.table.phaseLabel }}
      </span>
      <button
        data-slot="citadels-interface-scene"
        data-scene="draft"
        type="button"
        class="citadels-piece citadels-piece--plate px-2 py-1 font-mono text-[0.5rem] tracking-[0.14em] uppercase"
        @click="showing = showing === 'turn' ? 'draft' : 'turn'"
      >
        {{ showing === "turn" ? "show the draft" : "show the turn" }}
      </button>
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
