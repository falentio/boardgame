<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { SeatRow } from "@/composables/room-domain.ts"
import { initialsOf, labelOf } from "./labels.ts"

defineProps<{ seats: readonly SeatRow[] }>()
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
      <div class="flex min-w-0 items-center gap-2">
        <Avatar v-if="seat.occupant !== null" class="h-8 w-8 rounded-lg">
          <AvatarImage :src="seat.image" :alt="seat.name ?? labelOf(seat)" />
          <AvatarFallback class="rounded-lg">
            {{ initialsOf(seat.name) }}
          </AvatarFallback>
        </Avatar>
        <span v-if="seat.occupant !== null && seat.name !== null" class="truncate text-sm">
          {{ seat.name }}
        </span>
        <Badge :variant="seat.occupant !== null ? 'secondary' : 'outline'">
          {{ labelOf(seat) }}
        </Badge>
      </div>
    </li>
  </ul>
</template>
