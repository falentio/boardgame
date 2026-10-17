<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { ArrowLeft, Coins } from "@lucide/vue";
import CitadelsHand from "./CitadelsHand.vue";
import CitadelsSeat from "./CitadelsSeat.vue";
import CitadelsTable from "./CitadelsTable.vue";
import DistrictCard from "../DistrictCard.vue";
import type { CitadelsBoard, SeatPlate } from "@/composables/citadels-board.ts";

const props = defineProps<{ board: CitadelsBoard }>();

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
    class="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 group-data-[orientation=landscape]/surface:overflow-hidden group-data-[orientation=landscape]/surface:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_15rem] group-data-[orientation=landscape]/surface:grid-rows-[minmax(0,1fr)]"
  >
    <div
      data-slot="citadels-self"
      class="order-1 flex min-h-0 flex-col gap-3 group-data-[orientation=landscape]/surface:order-2 group-data-[orientation=landscape]/surface:overflow-y-auto group-data-[orientation=landscape]/surface:px-3"
    >
      <header class="flex flex-wrap items-baseline gap-3">
        <h2 class="text-2xl leading-none font-semibold tracking-tight">
          {{ isMine ? "Your district" : `${shown.name}'s district` }}
        </h2>
        <span
          class="inline-flex items-center gap-1 text-xl leading-none font-semibold text-amber-500 tabular-nums"
          :aria-label="`${shown.gold} gold`"
        >
          <Coins class="size-4" aria-hidden="true" />{{ shown.gold }}
        </span>
        <span class="text-sm leading-none text-muted-foreground tabular-nums"
          >{{ shown.city.length }} of {{ board.me.cityTarget }} districts</span
        >
        <button
          v-if="!isMine"
          type="button"
          data-slot="citadels-back"
          class="ms-auto inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs leading-none font-medium ring-1 ring-foreground/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          @click="focusedSeat = null"
        >
          <ArrowLeft class="size-3.5" aria-hidden="true" />Your board
        </button>
      </header>

      <ul data-slot="citadels-city" class="grid grid-cols-3 gap-2">
        <li v-for="(card, index) in shown.city" :key="`${card.id}-${index}`">
          <DistrictCard :district="card.id" :gold="card.gold" class="w-full" />
        </li>
        <li
          v-for="n in Math.max(0, board.me.cityTarget - shown.city.length)"
          :key="`empty-${n}`"
          class="flex h-12 items-center justify-center rounded-lg text-xs leading-none text-muted-foreground ring-1 ring-foreground/15 ring-dashed"
        >
          +
        </li>
      </ul>

      <template v-if="isMine">
        <section
          data-slot="citadels-window"
          class="flex flex-col gap-1 rounded-xl bg-card p-3 text-sm leading-snug ring-1 ring-foreground/10"
        >
          <p v-if="board.table.window" role="status">
            {{ board.table.window.label }}
            <span v-if="board.table.window.owedByMe" class="font-medium text-primary"
              >· you owe input</span
            >
          </p>
          <p v-else role="status" class="text-muted-foreground">No window open.</p>
          <p v-if="claim" class="text-xs leading-snug text-muted-foreground">{{ claim }}</p>
        </section>

        <CitadelsHand :hand="board.me.hand" />
      </template>
    </div>

    <CitadelsTable :board="board" class="order-2 group-data-[orientation=landscape]/surface:order-1" />

    <aside
      data-slot="citadels-players"
      class="order-3 flex min-h-0 flex-col gap-2 group-data-[orientation=landscape]/surface:overflow-y-auto"
    >
      <span
        class="text-[0.625rem] leading-none font-semibold tracking-[0.2em] text-muted-foreground uppercase"
        >Players</span
      >
      <div
        data-slot="citadels-opponents"
        class="flex flex-col gap-2 group-data-[orientation=landscape]/surface:h-full group-data-[orientation=landscape]/surface:overflow-y-auto"
      >
        <CitadelsSeat
          v-for="rival in board.opponents"
          :key="rival.seat"
          :rival="rival"
          :focused="rival.seat === focusedSeat"
          @focus="focusedSeat = rival.seat"
        />
        <p
          v-if="board.opponents.length === 0"
          class="text-xs leading-tight text-muted-foreground italic"
        >
          playing solo
        </p>
      </div>
    </aside>
  </div>
</template>
