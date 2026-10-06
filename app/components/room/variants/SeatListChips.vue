<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { SeatRow } from "@/composables/room-domain.ts"
import { initialsOf, labelOf } from "./labels.ts"

defineProps<{ seats: readonly SeatRow[] }>()
</script>

<template>
  <ul class="flex flex-wrap gap-2">
    <li
      v-for="seat in seats"
      :key="seat.index"
      class="flex items-center gap-2 rounded-full border py-1 ps-1 pe-3"
      :class="seat.occupant === null ? 'border-dashed' : ''"
      :data-seat="seat.index"
    >
      <Avatar v-if="seat.occupant !== null" class="h-6 w-6 rounded-full">
        <AvatarImage :src="seat.image" :alt="seat.name ?? labelOf(seat)" />
        <AvatarFallback class="rounded-full text-[10px]">
          {{ initialsOf(seat.name) }}
        </AvatarFallback>
      </Avatar>
      <span v-else class="bg-muted text-foreground flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums">
        {{ seat.index + 1 }}
      </span>
      <span class="text-sm leading-none" :class="seat.occupant === null ? 'text-muted-foreground' : ''">
        {{ seat.occupant === null ? "Open" : seat.name ?? labelOf(seat) }}
      </span>
      <span
        v-if="seat.occupant !== null && seat.isMe"
        class="text-muted-foreground text-xs leading-none"
      >
        You
      </span>
    </li>
  </ul>
</template>
