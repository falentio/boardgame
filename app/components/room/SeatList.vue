<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { SeatRow } from "@/composables/room-domain.ts"

defineProps<{ seats: readonly SeatRow[] }>()

const labelOf = (seat: SeatRow): string => {
  if (seat.occupant === null) return "Open"
  if (seat.isMe) return "You"
  if (seat.isHost) return "Host"
  return "Player"
}

const initialsOf = (name: string | null): string => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
  return (first + last).toUpperCase()
}
</script>

<template>
  <ul class="flex flex-col gap-2">
    <li
      v-for="seat in seats"
      :key="seat.index"
      class="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
      :data-seat="seat.index"
    >
      <span class="text-sm font-medium tabular-nums">Seat {{ seat.index + 1 }}</span>
      <div class="flex items-center gap-2">
        <Avatar v-if="seat.occupant !== null" class="h-8 w-8 rounded-lg">
          <AvatarImage :src="seat.image" :alt="seat.name ?? labelOf(seat)" />
          <AvatarFallback class="rounded-lg">
            {{ initialsOf(seat.name) }}
          </AvatarFallback>
        </Avatar>
        <span v-if="seat.occupant !== null && seat.name !== null" class="text-sm">
          {{ seat.name }}
        </span>
        <Badge :variant="seat.occupant !== null ? 'secondary' : 'outline'">
          {{ labelOf(seat) }}
        </Badge>
      </div>
    </li>
  </ul>
</template>
