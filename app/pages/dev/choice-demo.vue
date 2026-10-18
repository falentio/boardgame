<script setup lang="ts">
import { computed, ref } from "vue";
import CitadelsChoice from "@/components/citadels/board/CitadelsChoice.vue";
import { citadelsBoardOf, type CitadelsBoard } from "@/composables/citadels-board.ts";
import {
  BASE_CAST,
  charactersOfRank,
  citadels,
  specOfCharacter,
  specOfDistrict,
  type CharacterId,
  type CitadelsAction,
  type CitadelsState,
  type CitadelsView,
  type Rank,
} from "#shared/core/lockstep/games/citadels/index.ts";
import { act, frameIndex, genesisSeed, makeRandom, makeRoster, type SeatId } from "#shared/core/lockstep/index.ts";
import { seatId } from "#shared/rooms/ids.ts";

definePageMeta({ layout: false });

const ANN = seatId("ann");
const BOB = seatId("bob");
const CARA = seatId("cara");
const SEATS = [ANN, BOB, CARA];
const SEED = genesisSeed("choice-demo");
const NAMES = new Map([
  [ANN, "Ada"],
  [BOB, "Bo"],
  [CARA, "Cy"],
]);

/** A legal rank-1..8 cast carrying `target`, plus rank 9 when it lives there. */
const castWith = (target: CharacterId): readonly CharacterId[] => {
  const cast: CharacterId[] = [];
  for (let rank = 1 as Rank; rank <= 8; rank = (rank + 1) as Rank) {
    const at = charactersOfRank(rank);
    const fallback = at[0];
    if (fallback === undefined) throw new Error(`no character at rank ${String(rank)}`);
    cast.push(at.includes(target) ? target : fallback);
  }
  if (specOfCharacter(target).rank === 9) cast.push(target);
  return cast;
};

type Decide = (seat: SeatId, state: CitadelsState) => CitadelsAction | null;

/** The engine's always-legal policy, read against a folded state. */
const auto: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  const window = view.window;
  if (window === null) return null;
  if (window.purpose === "turn") {
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
    if (view.myHand.length < 4 && view.deckCount > 0) return { t: "draw" };
    return { t: "gold" };
  }
  if (window.purpose === "keep") return { t: "keep", index: 0 };
  if (window.purpose === "draft-pick") {
    const pick = view.cast[0];
    return pick === undefined ? null : { t: "pick", character: pick };
  }
  return null;
};

/** One frame, every owed seat answered by `decide`. */
const advance = (state: CitadelsState, decide: Decide): CitadelsState =>
  citadels.step(
    state,
    {
      index: frameIndex(0),
      seed: SEED,
      inputs: citadels.seatsOwed(state, frameIndex(0)).map((seat) => {
        const action = decide(seat, state);
        return [seat, action === null ? { kind: "idle" } : act<CitadelsAction>(action)];
      }),
    },
    makeRandom(SEED),
  );

const openPurpose = (state: CitadelsState): string | null => {
  const top = state.steps[0];
  return top !== undefined && top.kind === "window" ? top.window.purpose : null;
};

const answeringSeat = (state: CitadelsState): SeatId => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no window open");
  return top.window.kind === "any"
    ? (state.pending?.actor ?? state.active)
    : (top.window.seats[0] ?? state.active);
};

interface Fold {
  readonly purpose: string;
  readonly cast: readonly CharacterId[];
  readonly decide: Decide;
  readonly until?: (state: CitadelsState) => boolean;
}

const spySeat: Decide = (seat, state) => {
  if (openPurpose(state) === "choose-seat") {
    const rival = SEATS.find((candidate) => candidate !== seat);
    return rival === undefined ? null : { t: "target", seat: rival };
  }
  return auto(seat, state);
};

const warlordCity: Decide = (seat, state) => {
  if (openPurpose(state) === "warlord-destroy" && state.pending?.target === null) {
    const pick = state.players
      .filter((player) => player.seat !== seat)
      .sort((a, b) => b.city.length - a.city.length)[0];
    return pick === undefined || pick.city.length === 0
      ? { t: "pass" }
      : { t: "target", seat: pick.seat };
  }
  return auto(seat, state);
};

const FOLDS: readonly Fold[] = [
  { purpose: "choose-character", cast: BASE_CAST, decide: auto },
  { purpose: "choose-seat", cast: castWith("spy"), decide: auto },
  { purpose: "choose-type", cast: castWith("spy"), decide: spySeat },
  { purpose: "magician-discard", cast: castWith("magician"), decide: auto },
  {
    purpose: "warlord-destroy",
    cast: castWith("warlord"),
    decide: warlordCity,
    until: (state) => state.pending?.target !== null,
  },
  { purpose: "tax-collect", cast: castWith("tax-collector"), decide: auto },
];

interface Panel {
  readonly purpose: string;
  readonly cast: readonly CharacterId[];
  readonly board: CitadelsBoard;
  readonly frames: number;
}

/** Fold real frames from a real genesis until the purpose tops the window stack. */
const foldTo = (fold: Fold): { readonly state: CitadelsState; readonly frames: number } => {
  let state = citadels.genesis(
    { cast: [...fold.cast] },
    makeRoster(SEATS),
    makeRandom(SEED),
  );
  const ready = fold.until ?? ((): boolean => true);
  for (let frames = 0; frames < 4000; frames += 1) {
    if (openPurpose(state) === fold.purpose && ready(state)) return { state, frames };
    state = advance(state, fold.decide);
  }
  throw new Error(`the engine reached no ${fold.purpose} window`);
};

const panels = ref<readonly Panel[]>([]);
const chosen = ref<string | null>(null);

const build = (): void => {
  panels.value = FOLDS.map((fold) => {
    const { state, frames } = foldTo(fold);
    const seat = answeringSeat(state);
    return {
      purpose: fold.purpose,
      cast: fold.cast,
      board: citadelsBoardOf(citadels.project(state, seat), NAMES),
      frames,
    };
  });
};

const choose = (purpose: string, action: CitadelsAction): void => {
  chosen.value = `${purpose} :: ${JSON.stringify(action)}`;
};

build();

const totals = computed(() =>
  panels.value.map((panel) => ({
    purpose: panel.purpose,
    choices: panel.board.table.window?.choices.length ?? 0,
    frames: panel.frames,
  })),
);
</script>

<template>
  <main class="min-h-dvh bg-monokai-bg p-2 text-monokai-fg">
    <header class="flex flex-wrap items-center gap-2 p-1">
      <h1 class="font-mono text-[0.6875rem] leading-none font-bold tracking-[0.16em] uppercase">
        Window choices · folded from genesis
      </h1>
      <button
        type="button"
        data-slot="choice-demo-build"
        class="citadels-piece citadels-piece--plate px-2 py-1 font-mono text-[0.5625rem] leading-none font-bold tracking-[0.16em] uppercase"
        @click="build"
      >
        Fold the engine
      </button>
      <span data-slot="choice-demo-log" class="citadels-label">{{ chosen ?? "no choice reported" }}</span>
    </header>

    <section class="grid grid-cols-1 gap-1 lg:grid-cols-3">
      <article
        v-for="panel in panels"
        :key="panel.purpose"
        data-slot="choice-demo-panel"
        :data-purpose="panel.purpose"
        :data-model-count="panel.board.table.window?.choices.length ?? 0"
        :data-frames="panel.frames"
        class="citadels-piece flex flex-col gap-1 bg-monokai-panel p-2"
      >
        <span class="citadels-label">{{ panel.purpose }} · {{ panel.frames }} frames</span>
        <CitadelsChoice :board="panel.board" @choose="(action) => choose(panel.purpose, action)" />
      </article>
    </section>

    <p data-slot="choice-demo-totals" class="citadels-label p-1">
      {{ totals.map((row) => `${row.purpose}=${row.choices}`).join(" · ") }}
    </p>
  </main>
</template>
