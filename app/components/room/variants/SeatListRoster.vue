<script setup lang="ts">
import { computed } from "vue"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { SeatRow } from "@/composables/room-domain.ts"
import { initialsOf, labelOf } from "./labels.ts"

const props = defineProps<{ seats: readonly SeatRow[] }>()

const filled = computed(() => props.seats.filter((seat) => seat.occupant !== null))
const openCount = computed(() => props.seats.filter((seat) => seat.occupant === null).length)
</script>

<template>
  <div class="flex flex-col gap-3">
    <ul class="flex flex-col gap-1">
      <li
        v-for="seat in filled"
        :key="seat.index"
        class="flex min-w-0 items-center gap-3 rounded-lg px-2 py-2"
        :data-seat="seat.index"
      >
        <Avatar class="h-10 w-10 rounded-full">
          <AvatarImage :src="seat.image" :alt="seat.name ?? labelOf(seat)" />
          <AvatarFallback class="rounded-full">
            {{ initialsOf(seat.name) }}
          </AvatarFallback>
        </Avatar>
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-base leading-tight font-medium">
            {{ seat.name ?? labelOf(seat) }}
          </span>
          <span class="text-muted-foreground text-xs leading-tight">
            {{ seat.isHost ? "Host" : "Player" }}<template v-if="seat.isMe"> · You</template>
          </span>
        </div>
      </li>
    </ul>
    <p v-if="openCount > 0" class="text-muted-foreground px-2 text-sm leading-normal tabular-nums">
      {{ openCount }} {{ openCount === 1 ? "seat" : "seats" }} still open
    </p>
  </div>
</template>
