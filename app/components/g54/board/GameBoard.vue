<script setup lang="ts">
import { computed } from "vue"
import type { Board } from "@/composables/board-view.ts"
import SeatPiece from "./SeatPiece.vue"
import TablePuck from "./TablePuck.vue"

const props = defineProps<{ board: Board }>()

const ordered = computed(() => {
  const me = props.board.seats.filter((seat) => seat.isMe)
  const rest = props.board.seats.filter((seat) => !seat.isMe)
  return [...me, ...rest]
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-5" data-slot="game-board">
    <div class="rounded-2xl border border-dashed border-foreground/15 bg-muted/30 px-6 py-5">
      <TablePuck :table="board.table" />
    </div>

    <ul class="grid grid-cols-1 gap-4 min-[400px]:grid-cols-2">
      <li
        v-for="seat in ordered"
        :key="seat.seat"
        class="min-w-0 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        :class="seat.isMe && 'ring-2 ring-primary/40 bg-primary/5'"
      >
        <SeatPiece :seat="seat" />
      </li>
    </ul>
  </div>
</template>
