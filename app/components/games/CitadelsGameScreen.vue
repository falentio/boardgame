<script setup lang="ts">
import { computed, ref } from "vue";
import { Minimize } from "@lucide/vue";
import FullscreenNotice from "@/components/citadels/FullscreenNotice.vue";
import CitadelsBoard from "@/components/citadels/board/CitadelsBoard.vue";
import CitadelsGate from "@/components/citadels/CitadelsGate.vue";
import GameStatusPanel from "@/components/games/GameStatusPanel.vue";
import { buttonVariants } from "@/components/ui/button";
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

const inFullscreen = computed(() => fullscreen.active.value);

const winnerLine = computed(() => {
  const winner = board.value?.table.winner ?? null;
  return winner === null ? "Game over" : `${winner.name} wins`;
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
          :class="buttonVariants({ variant: 'outline', size: 'sm' })"
          class="ms-auto"
          @click="leave"
        >
          <Minimize class="size-3.5" aria-hidden="true" />
          {{ inFullscreen ? "Exit fullscreen" : "Exit" }}
        </button>
      </header>

      <div
        v-if="board?.table.terminal"
        data-slot="citadels-terminal"
        role="status"
        class="flex shrink-0 flex-wrap items-center gap-3 border-b border-foreground/10 bg-primary/10 px-3 py-2 text-sm leading-normal"
      >
        <span class="font-semibold text-primary">{{ winnerLine }}</span>
        <NuxtLink to="/" class="text-primary underline-offset-4 hover:underline">
          Back to home
        </NuxtLink>
      </div>

      <FullscreenNotice
        :notice="notice"
        :can-retry="canRetry"
        class="shrink-0 px-3 py-2 text-xs"
        @retry="retry"
      />

      <CitadelsBoard v-if="board" :board="board" @pick="pickCharacter" />
      <p v-else role="status" class="text-muted-foreground p-3 text-sm leading-normal">
        Waiting for the game to start…
      </p>
    </section>
  </div>
</template>
