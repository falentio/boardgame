<script setup lang="ts">
import { computed, ref } from "vue";
import CitadelsBoard from "@/components/citadels/board/CitadelsBoard.vue";
import { citadelsBoardOf, type CitadelsBoard as Board } from "@/composables/citadels-board.ts";
import {
  BASE_CAST,
  charactersOfRank,
  citadels,
  specOfDistrict,
  type CharacterId,
  type CitadelsAction,
  type CitadelsState,
  type CitadelsView,
  type Rank,
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
const SEATS: readonly SeatId[] = [ANN, BOB, CARA];
const SEED = genesisSeed("motion-demo");
const NAMES: ReadonlyMap<SeatId, string> = new Map([
  [ANN, "Ada"],
  [BOB, "Bo"],
  [CARA, "Cy"],
]);

/** A legal rank-1..8 cast carrying the target, plus rank 9 when the target lives there. */
const castWith = (target: CharacterId): readonly CharacterId[] => {
  const cast: CharacterId[] = [];
  for (let rank = 1 as Rank; rank <= 8; rank = (rank + 1) as Rank) {
    const at = charactersOfRank(rank);
    const fallback = at[0];
    if (fallback === undefined) throw new Error(`no character at rank ${String(rank)}`);
    cast.push(at.includes(target) ? target : fallback);
  }
  if (charactersOfRank(9 as Rank).includes(target)) cast.push(target);
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

/** The same policy, except a gather takes cards so the keep window opens. */
const drawFirst: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose === "turn" && view.deckCount > 0) return { t: "draw" };
  return auto(seat, state);
};

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

const openPurpose = (state: CitadelsState): WindowPurpose | null => {
  const top = state.steps[0];
  return top !== undefined && top.kind === "window" ? top.window.purpose : null;
};

/** The seat a window's resolver reads (helpers.ts:1095 actorOf), or the seat it names. */
const answeringSeat = (state: CitadelsState): SeatId => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") return state.active;
  return top.window.kind === "any"
    ? (state.pending?.actor ?? state.active)
    : (top.window.seats[0] ?? state.active);
};

const owedAt = (state: CitadelsState, seat: SeatId): boolean =>
  citadels.project(state, seat).owedSeats.includes(seat);

interface Target {
  readonly id: "draft" | "turn" | "keep" | "choice";
  readonly ready: (state: CitadelsState) => boolean;
}

const TARGETS: readonly Target[] = [
  { id: "draft", ready: (state) => openPurpose(state) === "draft-pick" && owedAt(state, ANN) },
  {
    id: "turn",
    ready: (state) =>
      openPurpose(state) === "turn" && citadels.project(state, state.active).owedSeats.includes(state.active),
  },
  {
    id: "keep",
    ready: (state) => openPurpose(state) === "keep" && owedAt(state, answeringSeat(state)),
  },
  {
    id: "choice",
    ready: (state) =>
      openPurpose(state) === "choose-character" && owedAt(state, answeringSeat(state)),
  },
];

interface Scene {
  readonly id: Target["id"];
  readonly board: Board;
  readonly seat: SeatId;
  readonly frames: number;
  readonly purpose: WindowPurpose | null;
}

/** Fold real frames from a real deal until every scene a motion check needs has appeared. */
const foldScenes = (): readonly Scene[] => {
  const found = new Map<Target["id"], Scene>();
  const folds: readonly { readonly cast: readonly CharacterId[]; readonly decide: Decide }[] = [
    { cast: BASE_CAST, decide: drawFirst },
    { cast: castWith("thief"), decide: auto },
  ];
  for (const fold of folds) {
    let state = citadels.genesis(
      { cast: [...fold.cast] },
      makeRoster(SEATS),
      makeRandom(SEED),
    );
    for (let frames = 0; frames < 6000; frames += 1) {
      const target = TARGETS.find((candidate) => !found.has(candidate.id) && candidate.ready(state));
      if (target !== undefined) {
        const seat = target.id === "draft" ? ANN : answeringSeat(state);
        found.set(target.id, {
          id: target.id,
          board: citadelsBoardOf(citadels.project(state, seat), NAMES),
          seat,
          frames,
          purpose: openPurpose(state),
        });
      }
      if (found.size === TARGETS.length) return [...found.values()];
      state = advance(state, fold.decide);
    }
  }
  const missing = TARGETS.filter((target) => !found.has(target.id)).map((target) => target.id);
  throw new Error(`the engine reached no ${missing.join(", ")} window`);
};

const scenes = foldScenes();
const sceneId = ref<Scene["id"]>("draft");
const scene = computed(() => scenes.find((candidate) => candidate.id === sceneId.value) ?? scenes[0]!);
const table = computed(() => scene.value.board.table);

const facts = computed(() => ({
  scene: scene.value.id,
  frames: String(scene.value.frames),
  purpose: scene.value.purpose ?? "none",
  choices: String(table.value.window?.choices.length ?? 0),
  hand: String(scene.value.board.me.hand.length),
  cast: table.value.cast.map((slot) => slot.state).join(","),
  seats: String(scene.value.board.seats.length),
}));

const pickScene = (id: Scene["id"]): void => {
  sceneId.value = id;
};
</script>

<template>
  <section
    data-slot="citadels-surface"
    data-orientation="landscape"
    :data-scene="facts.scene"
    :data-scene-frames="facts.frames"
    :data-scene-purpose="facts.purpose"
    :data-scene-choices="facts.choices"
    :data-scene-hand="facts.hand"
    :data-scene-cast="facts.cast"
    :data-scene-seats="facts.seats"
    class="dark group/surface fixed inset-0 z-50 flex h-dvh min-h-0 flex-col bg-monokai-bg text-monokai-fg"
  >
    <header class="flex shrink-0 items-center gap-2 border-b border-foreground/10 px-2 py-1.5">
      <span data-slot="citadels-phase" class="text-sm leading-none font-semibold tabular-nums">
        Round {{ table.round }} · {{ table.phaseLabel }}
      </span>
      <ul data-slot="motion-demo-scenes" class="ms-auto flex flex-wrap items-center gap-1">
        <li v-for="candidate in scenes" :key="candidate.id">
          <button
            type="button"
            data-slot="motion-demo-scene"
            :data-scene="candidate.id"
            :aria-pressed="candidate.id === scene.id"
            class="citadels-piece citadels-piece--plate px-1.5 py-1 font-mono text-[0.5rem] leading-none font-bold tracking-[0.14em] uppercase"
            @click="pickScene(candidate.id)"
          >
            {{ candidate.id }}
          </button>
        </li>
      </ul>
    </header>

    <CitadelsBoard :board="scene.board" />
  </section>
</template>
