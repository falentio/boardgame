<script setup lang="ts">
import { computed } from "vue"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { SeatRow } from "@/composables/room-domain.ts"
import { initialsOf, labelOf } from "./labels.ts"

const props = defineProps<{ seats: readonly SeatRow[] }>()

const hostSeat = computed(() => props.seats.find((seat) => seat.isHost))
const others = computed(() => props.seats.filter((seat) => !seat.isHost))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="hostSeat"
      class="flex items-center gap-4 rounded-lg border bg-muted/40 p-4"
      :data-seat="hostSeat.index"
    >
      <Avatar class="h-12 w-12 rounded-full">
        <AvatarImage :src="hostSeat.image" :alt="hostSeat.name ?? 'Host'" />
        <AvatarFallback class="rounded-full">
          {{ initialsOf(hostSeat.name) }}
        </AvatarFallback>
      </Avatar>
      <div class="flex min-w-0 flex-col">
        <span class="truncate text-base leading-tight font-semibold">
          {{ hostSeat.name ?? "Host" }}
        </span>
        <span class="text-muted-foreground text-xs leading-tight">
          Host<template v-if="hostSeat.isMe"> · You</template>
        </span>
      </div>
    </div>

    <ul class="flex flex-col gap-1">
      <li
        v-for="seat in others"
        :key="seat.index"
        class="flex min-w-0 items-center gap-3 rounded-lg px-2 py-1.5"
        :data-seat="seat.index"
      >
        <Avatar v-if="seat.occupant !== null" class="h-8 w-8 rounded-full">
          <AvatarImage :src="seat.image" :alt="seat.name ?? labelOf(seat)" />
          <AvatarFallback class="rounded-full">
            {{ initialsOf(seat.name) }}
          </AvatarFallback>
        </Avatar>
        <span
          v-else
          class="border-muted-foreground/40 text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full border border-dashed text-xs tabular-nums"
        >
          {{ seat.index + 1 }}
        </span>
        <span class="truncate text-sm leading-normal" :class="seat.occupant === null ? 'text-muted-foreground' : ''">
          {{ seat.occupant === null ? "Open seat" : seat.name ?? labelOf(seat) }}
        </span>
        <span v-if="seat.isMe" class="text-muted-foreground ms-auto text-xs leading-none">You</span>
      </li>
    </ul>
  </div>
</template>