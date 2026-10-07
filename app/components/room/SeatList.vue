<script setup lang="ts">
import { computed } from "vue"
import { UserMinus } from "@lucide/vue"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { initialsOf } from "#shared/users/initials.ts"
import type { SeatRow } from "@/composables/room-domain.ts"
import type { UserId } from "#shared/rooms/ids.ts"

const props = withDefaults(defineProps<{ seats: readonly SeatRow[]; canKick?: boolean }>(), {
  canKick: false,
})
const emit = defineEmits<{ kick: [occupant: UserId] }>()

const labelOf = (seat: SeatRow): string => {
  if (seat.occupant === null) return "Open"
  if (seat.isMe) return "You"
  return "Player"
}

const showKick = (seat: SeatRow): boolean => props.canKick && seat.occupant !== null && seat.canKick

const kickLabel = (seat: SeatRow): string =>
  seat.occupant === null ? "Kick player" : `Kick ${seat.name ?? "player"}`

const askKick = (seat: SeatRow): void => {
  if (seat.occupant !== null) emit("kick", seat.occupant)
}

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
        <Button
          v-if="showKick(seat)"
          type="button"
          variant="destructive"
          size="icon-sm"
          class="ms-auto transition-[color,background-color] duration-150 ease-out"
          :aria-label="kickLabel(seat)"
          @click="askKick(seat)"
        >
          <UserMinus :stroke-width="1.5" aria-hidden="true" />
        </Button>
        <span v-else-if="seat.isMe" class="text-muted-foreground ms-auto text-xs leading-none">You</span>
      </li>
    </ul>
  </div>
</template>
