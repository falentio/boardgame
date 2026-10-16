<script setup lang="ts">
import CitadelsHand from "./CitadelsHand.vue";
import CitadelsSeat from "./CitadelsSeat.vue";
import CitadelsTable from "./CitadelsTable.vue";
import type { CitadelsBoard } from "@/composables/citadels-board.ts";

defineProps<{ board: CitadelsBoard }>();
</script>

<template>
  <div
    data-slot="citadels-board"
    class="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 p-3 group-data-[orientation=landscape]/surface:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] group-data-[orientation=landscape]/surface:grid-rows-[minmax(0,1fr)_auto]"
  >
    <div
      data-slot="citadels-opponents"
      class="flex min-h-0 flex-wrap gap-2 overflow-y-auto group-data-[orientation=landscape]/surface:flex-col group-data-[orientation=landscape]/surface:flex-nowrap"
    >
      <CitadelsSeat
        v-for="seat in board.opponents"
        :key="seat.seat"
        :seat="seat"
        class="w-full min-[420px]:w-60 group-data-[orientation=landscape]/surface:w-full"
      />
    </div>

    <CitadelsTable :table="board" />

    <div
      class="flex min-h-0 flex-col gap-2 group-data-[orientation=landscape]/surface:col-span-2 group-data-[orientation=landscape]/surface:flex-row"
    >
      <CitadelsSeat
        :seat="board.me"
        class="group-data-[orientation=landscape]/surface:w-72 group-data-[orientation=landscape]/surface:shrink-0"
      />
      <CitadelsHand :hand="board.me.hand" class="min-h-0 flex-1" />
    </div>
  </div>
</template>
