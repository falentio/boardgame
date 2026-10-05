<script setup lang="ts">
import { Badge } from "@/components/ui/badge"
import type { SeatRow } from "@/composables/room-domain.ts"

defineProps<{ seats: readonly SeatRow[] }>()

const labelOf = (seat: SeatRow): string => {
  if (!seat.filled) return "Open"
  if (seat.isMe) return "You"
  if (seat.isHost) return "Host"
  return "Player"
}
</script>

<template>
  <ul class="flex flex-col gap-2">
    <li
      v-for="seat in seats"
      :key="seat.index"
      class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
    >
      <span class="text-sm font-medium tabular-nums">Seat {{ seat.index + 1 }}</span>
      <Badge :variant="seat.filled ? 'secondary' : 'outline'">
        {{ labelOf(seat) }}
      </Badge>
    </li>
  </ul>
</template>
