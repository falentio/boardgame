<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowLeft, Coins } from "@lucide/vue";
import CitadelsActions from "./CitadelsActions.vue";
import CitadelsChoice from "./CitadelsChoice.vue";
import CitadelsHand from "./CitadelsHand.vue";
import CitadelsKeep from "./CitadelsKeep.vue";
import CitadelsPick from "./CitadelsPick.vue";
import CitadelsSeat from "./CitadelsSeat.vue";
import CitadelsTable from "./CitadelsTable.vue";
import DistrictCard from "../DistrictCard.vue";
import type { CitadelsBoard, SeatPlate } from "@/composables/citadels-board.ts";
import type { CharacterId, CitadelsAction } from "#shared/core/lockstep/games/citadels/index.ts";
import "./citadels-skin.css";

const props = defineProps<{ board: CitadelsBoard }>();
const emit = defineEmits<{
  pick: [character: CharacterId];
  keep: [index: number];
  gold: [];
  draw: [];
  build: [card: number];
  pass: [];
  choose: [action: CitadelsAction];
}>();

const focusedSeat = ref<SeatPlate["seat"] | null>(null);

watch(
  () => props.board.opponents.map((rival) => rival.seat).join(),
  (seats) => {
    if (focusedSeat.value !== null && !seats.split(",").includes(focusedSeat.value)) {
      focusedSeat.value = null;
    }
  },
);

const shown = computed<SeatPlate>(
  () => props.board.opponents.find((rival) => rival.seat === focusedSeat.value) ?? props.board.me,
);
const isMine = computed(() => shown.value.kind === "me");
/** With no hand left to draw, the city takes the whole column at half size. */
const cityHand = computed(() => (shown.value.kind === "me" ? shown.value.hand.length : 0));
const cityScale = computed(() => (isMine.value && cityHand.value === 0 ? 0.6 : 1));
const slotBox = computed(() => ({
  width: Math.round(143 * cityScale.value) + "px",
  height: Math.round(201 * cityScale.value) + "px",
}));

const claim = computed(() => {
  const pending = props.board.table.pending;
  if (pending === null) return null;
  const who =
    pending.characterName === null
      ? `${pending.actorName} is acting`
      : `${pending.actorName} claims ${pending.characterName}`;
  const on = pending.targetName === null ? "" : ` on ${pending.targetName}`;
  const cards = pending.cards === 0 ? "" : ` · ${pending.cards} cards`;
  return `${who}${on}${cards}`;
});
</script>

<template>
  <div
    data-slot="citadels-board"
    class="grid min-h-0 flex-1 grid-cols-1 gap-1 overflow-y-auto p-1 group-data-[orientation=landscape]/surface:overflow-hidden group-data-[orientation=landscape]/surface:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_15rem] group-data-[orientation=landscape]/surface:grid-rows-[minmax(0,1fr)]"
  >
    <div
      data-slot="citadels-self"
      class="relative order-1 flex min-h-0 flex-col gap-1 group-data-[orientation=landscape]/surface:order-2 group-data-[orientation=landscape]/surface:overflow-y-auto"
    >
      <header
        data-slot="citadels-self-plate"
        class="citadels-piece citadels-piece--thick flex items-stretch"
      >
        <span class="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5">
          <h2 class="min-w-0 text-xs leading-none font-bold tracking-[0.08em] text-monokai-fg uppercase [overflow-wrap:anywhere]">
            {{ isMine ? "Your district" : `${shown.name}'s district` }}
          </h2>
          <span
            data-slot="citadels-self-gold"
            class="citadels-piece citadels-piece--plate ms-auto flex shrink-0 items-center gap-1 px-1 py-0.5"
            :aria-label="`${shown.gold} gold`"
          >
            <Coins class="size-2.5 text-monokai-yellow" aria-hidden="true" />
            <span class="citadels-ink text-[0.6875rem] leading-none font-bold">{{ shown.gold }}</span>
          </span>
          <span
            data-slot="citadels-self-city"
            class="citadels-piece citadels-piece--plate flex shrink-0 items-center gap-1 px-1 py-0.5"
          >
            <span class="citadels-label !text-[0.5rem]">dist</span>
            <span class="text-[0.6875rem] leading-none font-bold tabular-nums text-monokai-fg"
              >{{ shown.city.length }}<span class="text-monokai-comment">/{{ board.me.cityTarget }}</span></span
            >
          </span>
        </span>
        <button
          v-if="!isMine"
          type="button"
          data-slot="citadels-back"
          class="citadels-piece citadels-piece--plate flex shrink-0 items-center gap-1 px-1.5 text-[0.5rem] tracking-[0.14em] uppercase"
          @click="focusedSeat = null"
        >
          <ArrowLeft class="size-3" aria-hidden="true" /><span class="citadels-label !text-[0.5rem]">your board</span>
        </button>
      </header>

      <ul data-slot="citadels-city" class="flex flex-wrap gap-1">
        <li
          v-for="(card, index) in shown.city"
          :key="`${card.id}-${index}`"
          :style="{ zoom: cityScale }"
        >
          <DistrictCard :district="card.id" :gold="card.gold" />
        </li>
        <li
          v-for="n in Math.max(0, board.me.cityTarget - shown.city.length)"
          :key="`empty-${n}`"
          class="flex shrink-0 items-center justify-center border border-dashed border-monokai-line font-mono text-lg text-monokai-comment"
          :style="slotBox"
        >
          +
        </li>
      </ul>

      <CitadelsPick :board="board" @pick="(character) => emit('pick', character)" />

      <template v-if="isMine">
        <section
          data-slot="citadels-window"
          class="citadels-piece citadels-piece--plate flex flex-col gap-1 px-2 py-1.5"
        >
          <p v-if="board.table.window" role="status" class="flex items-baseline gap-1.5">
            <span
              class="text-[0.5625rem] leading-none tracking-[0.16em] uppercase"
              :class="board.table.window.owedByMe ? 'text-monokai-green' : 'text-monokai-fg'"
              >{{ board.table.window.label }}</span
            >
            <span
              v-if="board.table.window.owedByMe"
              data-slot="citadels-owed-flag"
              class="citadels-plate px-1 py-0.5 text-[0.5rem] leading-none font-bold tracking-[0.14em]"
              >you owe</span
            >
          </p>
          <p v-else role="status" class="citadels-label">no window open</p>
          <p v-if="claim" class="text-[0.5625rem] leading-tight tracking-[0.1em] text-monokai-comment uppercase">
            {{ claim }}
          </p>
        </section>

        <CitadelsChoice :board="board" @choose="(action) => emit('choose', action)" />

        <CitadelsActions
          :board="board"
          @gold="emit('gold')"
          @draw="emit('draw')"
          @build="(card) => emit('build', card)"
          @pass="emit('pass')"
        />

        <CitadelsKeep :board="board" @keep="(index) => emit('keep', index)" />

        <CitadelsHand :hand="board.me.hand" />
      </template>
    </div>

    <CitadelsTable :board="board" class="order-2 group-data-[orientation=landscape]/surface:order-1" />

    <aside
      data-slot="citadels-players"
      class="order-3 flex min-h-0 flex-col gap-1 group-data-[orientation=landscape]/surface:overflow-y-auto"
    >
      <span class="citadels-label">Players</span>
      <div
        data-slot="citadels-opponents"
        class="flex flex-col gap-1 group-data-[orientation=landscape]/surface:h-full group-data-[orientation=landscape]/surface:overflow-y-auto"
      >
        <CitadelsSeat
          v-for="seat in board.seats"
          :key="seat.seat"
          :seat="seat"
          :focused="seat.seat === focusedSeat"
          @focus="focusedSeat = seat.kind === 'rival' ? seat.seat : null"
        />
        <p
          v-if="board.opponents.length === 0"
          class="font-mono text-[0.5625rem] leading-tight text-monokai-comment"
        >
          playing solo
        </p>
      </div>
    </aside>
  </div>
</template>
