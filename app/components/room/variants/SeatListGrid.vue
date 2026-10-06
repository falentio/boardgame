<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { SeatRow } from "@/composables/room-domain.ts"
import { initialsOf, labelOf } from "./labels.ts"

defineProps<{ seats: readonly SeatRow[] }>()
</script>

<template>
  <ul class="grid grid-cols-2 gap-2 sm:grid-cols-3">
    <li
      v-for="seat in seats"
      :key="seat.index"
      class="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center"
      :class="seat.occupant === null ? 'border-dashed' : ''"
      :data-seat="seat.index"
    >
      <template v-if="seat.occupant !== null">
        <Avatar class="h-10 w-10 rounded-full">
          <AvatarImage :src="seat.image" :alt="seat.name ?? labelOf(seat)" />
          <AvatarFallback class="rounded-full">
            {{ initialsOf(seat.name) }}
          </AvatarFallback>
        </Avatar>
        <span class="w-full truncate text-sm leading-tight font-medium">
          {{ seat.name ?? labelOf(seat) }}
        </span>
        <span class="text-muted-foreground text-xs leading-none">
          {{ labelOf(seat) }}
        </span>
      </template>
      <template v-else>
        <span class="text-muted-foreground text-sm leading-none font-medium">Open</span>
        <span class="text-muted-foreground text-xs leading-none tabular-nums">
          Seat {{ seat.index + 1 }}
        </span>
      </template>
    </li>
  </ul>
</template>
