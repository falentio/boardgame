<script setup lang="ts">
import { computed, ref } from "vue";
import { Coins, Crown, Layers, LogOut, Minimize } from "@lucide/vue";
import FullscreenNotice from "@/components/citadels/FullscreenNotice.vue";
import CitadelsBoard from "@/components/citadels/board/CitadelsBoard.vue";
import "@/components/citadels/board/citadels-skin.css";
import CitadelsGate from "@/components/citadels/CitadelsGate.vue";
import GameStatusPanel from "@/components/games/GameStatusPanel.vue";
import { citadelsBoardOf } from "@/composables/citadels-board.ts";
import { useFullscreen } from "@/composables/fullscreen.ts";
import { openSurface, type SurfacePhase } from "@/composables/immersive-surface.ts";
import { useOrientation } from "@/composables/orientation.ts";
import { useGame } from "@/composables/useGame";
import type { Room } from "@/composables/room-domain.ts";
import type { RoomLike } from "#shared/game/index.ts";
import type { CitadelsAction, CitadelsSetup, CharacterId } from "#shared/core/lockstep/games/citadels/index.ts";
import { act } from "#shared/core/lockstep/index.ts";
import { citadels } from "#shared/core/lockstep/games/citadels/index.ts";
import { seatId, type SeatId, type UserId } from "#shared/rooms/ids.ts";

const props = defineProps<{
  room: Room;
  viewer: UserId | null;
  loadFailed?: string | null;
}>();

const citadelsRoom = computed<RoomLike<CitadelsSetup> | null>(() => {
  const room = props.room;
  if (room.setup.game !== "citadels") return null;
  return { code: room.code, setup: room.setup, seats: room.seats, startedAt: room.startedAt };
});

const viewer = computed(() => props.viewer);

const names = computed<ReadonlyMap<SeatId, string>>(() => {
  const map = new Map<SeatId, string>();
  for (const seat of props.room.seats) {
    if (seat.occupant === null) continue;
    map.set(seatId(seat.id), seat.name ?? "Player");
  }
  return map;
});

const { view, status, report } = useGame({
  game: citadels,
  room: citadelsRoom,
  viewer,
});

const board = computed(() =>
  view.value === null ? null : citadelsBoardOf(view.value, names.value),
);

const immersive = ref<Element | null>(null);
const phase = ref<SurfacePhase>("gate");
const fullscreen = useFullscreen({ target: immersive });
const { orientation } = useOrientation();
const { canEnter, canRetry, enter, leave, notice, retry } = openSurface({ phase, fullscreen });

const pickCharacter = (character: CharacterId): void => {
  report(act<CitadelsAction>({ t: "pick", character }));
};

const keepCard = (index: number): void => {
  report(act<CitadelsAction>({ t: "keep", index }));
};

const gatherGold = (): void => {
  report(act<CitadelsAction>({ t: "gold" }));
};

const drawCards = (): void => {
  report(act<CitadelsAction>({ t: "draw" }));
};

const buildCard = (card: number): void => {
  report(act<CitadelsAction>({ t: "build", card }));
};

const passTurn = (): void => {
  report(act<CitadelsAction>({ t: "pass" }));
};

const chooseAction = (action: CitadelsAction): void => {
  report(act<CitadelsAction>(action));
};

const inFullscreen = computed(() => fullscreen.active.value);

/** The board carries no point total, so the plate shows the winner's own tally. */
const terminalPlate = computed(() => {
  const current = board.value;
  if (current === null || !current.table.terminal) return null;
  const winner = current.table.winner;
  const seat = winner === null ? null : (current.seats.find((row) => row.seat === winner.seat) ?? null);
  return {
    winner: winner === null ? null : winner.name,
    districts: seat?.city.length ?? 0,
    gold: seat?.gold ?? 0,
    cityTarget: current.me.cityTarget,
  };
});
</script>

<template>
  <div ref="immersive" data-slot="citadels-immersive">
    <GameStatusPanel v-if="phase === 'gate'" :status="status" :failed="loadFailed">
      <CitadelsGate
        v-if="board"
        :table="board.table"
        :can-enter="canEnter"
        :can-retry="canRetry"
        :notice="notice"
        @open="enter"
        @retry="retry"
      />
    </GameStatusPanel>

    <section
      v-else
      data-slot="citadels-surface"
      :data-orientation="orientation"
      :data-phase="board?.table.phase"
      class="dark group/surface fixed inset-0 z-50 flex h-dvh min-h-0 flex-col bg-monokai-bg text-monokai-fg"
    >
      <header
        v-if="board"
        class="flex shrink-0 items-center gap-3 border-b border-foreground/10 px-3 py-2"
      >
        <span data-slot="citadels-phase" class="text-sm leading-none font-semibold tabular-nums">
          Round {{ board.table.round }} · {{ board.table.phaseLabel }}
        </span>
        <button
          data-slot="citadels-exit"
          type="button"
          class="citadels-piece citadels-piece--plate ms-auto flex shrink-0 items-center gap-1 px-1.5 py-1"
          @click="leave"
        >
          <Minimize class="size-3 shrink-0" aria-hidden="true" />
          <span class="citadels-label !text-[0.5rem] !text-monokai-fg">{{
            inFullscreen ? "exit fullscreen" : "exit"
          }}</span>
        </button>
      </header>

      <section
        v-if="terminalPlate"
        data-slot="citadels-terminal"
        role="status"
        class="citadels-piece citadels-piece--thick mx-1 mt-1 flex shrink-0 flex-wrap items-center gap-2 px-2 py-1.5"
      >
        <span class="flex min-w-0 items-center gap-1.5">
          <Crown class="size-3 shrink-0 text-monokai-yellow" aria-hidden="true" />
          <span
            data-slot="citadels-terminal-winner"
            class="min-w-0 font-mono text-[0.6875rem] leading-none font-bold tracking-[0.14em] text-monokai-fg uppercase [overflow-wrap:anywhere]"
            >{{ terminalPlate.winner ?? "no winner" }}</span
          >
          <span v-if="terminalPlate.winner !== null" class="citadels-label !text-[0.5rem]">wins</span>
        </span>

        <span
          data-slot="citadels-terminal-score"
          class="citadels-piece citadels-piece--plate flex shrink-0 items-center gap-1 px-1 py-0.5"
        >
          <Layers class="size-2.5 shrink-0 text-monokai-yellow" aria-hidden="true" />
          <span class="citadels-label !text-[0.5rem]">dist</span>
          <span class="text-[0.6875rem] leading-none font-bold tabular-nums text-monokai-fg"
            >{{ terminalPlate.districts }}<span class="text-monokai-comment">/{{ terminalPlate.cityTarget }}</span></span
          >
        </span>

        <span
          data-slot="citadels-terminal-gold"
          class="citadels-piece citadels-piece--plate flex shrink-0 items-center gap-1 px-1 py-0.5"
        >
          <Coins class="size-2.5 shrink-0 text-monokai-yellow" aria-hidden="true" />
          <span class="citadels-ink text-[0.6875rem] leading-none font-bold">{{ terminalPlate.gold }}</span>
        </span>

        <NuxtLink
          to="/"
          data-slot="citadels-terminal-exit"
          class="citadels-piece citadels-piece--plate ms-auto flex shrink-0 items-center gap-1 px-1.5 py-1"
        >
          <LogOut class="size-3 shrink-0" aria-hidden="true" />
          <span class="citadels-label !text-[0.5rem] !text-monokai-fg">home</span>
        </NuxtLink>
      </section>

      <FullscreenNotice
        :notice="notice"
        :can-retry="canRetry"
        class="shrink-0 px-3 py-2 text-xs"
        @retry="retry"
      />

      <CitadelsBoard
        v-if="board"
        :board="board"
        @pick="pickCharacter"
        @keep="keepCard"
        @gold="gatherGold"
        @draw="drawCards"
        @build="buildCard"
        @pass="passTurn"
        @choose="chooseAction"
      />
      <p v-else role="status" class="text-muted-foreground p-3 text-sm leading-normal">
        Waiting for the game to start…
      </p>
    </section>
  </div>
</template>

<style scoped>
/* The game ends once, so this plate is the one arrival that earns 300ms. */
[data-slot="citadels-terminal"] {
  transition:
    opacity var(--dur-arrival) var(--ease-out),
    translate var(--dur-arrival) var(--ease-out),
    box-shadow var(--dur-ink) ease,
    background-color var(--dur-ink) ease,
    color var(--dur-ink) ease;
  @starting-style {
    opacity: 0;
    translate: 0 5px;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-slot="citadels-terminal"] {
    transition-property: opacity, box-shadow, background-color, color;
    @starting-style {
      translate: none;
    }
  }
}
</style>
