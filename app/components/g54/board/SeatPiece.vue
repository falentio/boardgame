<script setup lang="ts">
import { computed } from "vue"
import { Bomb, Coins } from "@lucide/vue"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { initialsOf } from "#shared/users/initials.ts"
import { specOf } from "#shared/core/lockstep/games/g54/roles.ts"
import type { BoardSeat } from "@/composables/board-view.ts"

const props = defineProps<{ seat: BoardSeat }>()

const ringClass = computed(() => {
  if (props.seat.phase === "acting") return "ring-2 ring-primary ring-offset-2 ring-offset-background"
  if (props.seat.phase === "owed") return "ring-2 ring-amber-500 ring-offset-2 ring-offset-background"
  if (props.seat.phase === "targeted") return "ring-2 ring-destructive ring-offset-2 ring-offset-background"
  return "ring-1 ring-foreground/15"
})

const phaseLabel = computed(() => {
  if (props.seat.phase === "acting") return "Acting"
  if (props.seat.phase === "owed") return "Owes input"
  if (props.seat.phase === "targeted") return "Targeted"
  return null
})

const phaseClass = computed(() => {
  if (props.seat.phase === "acting") return "bg-primary text-primary-foreground"
  if (props.seat.phase === "owed") return "bg-amber-500 text-black"
  if (props.seat.phase === "targeted") return "bg-destructive text-white"
  return ""
})

const revealedNames = computed(() => props.seat.revealed.map((role) => specOf(role).name).join(", "))
</script>

<template>
  <div
    class="flex flex-col gap-3"
    :data-seat="seat.seat"
  >
    <div class="flex items-center gap-3">
      <Avatar class="size-11 shrink-0 rounded-full transition-shadow duration-200 ease-out" :class="ringClass">
        <AvatarImage v-if="seat.image" :src="seat.image" :alt="seat.name" />
        <AvatarFallback class="rounded-full text-xs">
          {{ initialsOf(seat.name) }}
        </AvatarFallback>
      </Avatar>
      <div class="flex min-w-0 flex-col gap-1">
        <div class="flex min-w-0 items-center gap-1.5">
          <span class="truncate text-sm leading-tight font-semibold">{{ seat.name }}</span>
          <span
            v-if="seat.isMe"
            class="text-muted-foreground shrink-0 text-[0.625rem] leading-none font-medium tracking-wide uppercase"
          >
            You
          </span>
        </div>
        <span
          class="inline-flex items-center gap-1 text-xs leading-none font-medium tabular-nums"
          :aria-label="`${seat.coins} coins`"
        >
          <Coins class="text-amber-500 size-3.5" aria-hidden="true" />
          {{ seat.coins }}
        </span>
      </div>
      <span
        v-if="phaseLabel"
        class="ms-auto shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] leading-none font-semibold tracking-wide uppercase transition-colors duration-150 ease-out"
        :class="phaseClass"
      >
        {{ phaseLabel }}
      </span>
    </div>

    <div class="flex flex-wrap items-end gap-3">
      <div
        v-if="seat.isMe"
        class="flex items-end gap-1.5"
        :aria-label="seat.hand.length === 0 ? 'no cards' : `your hand: ${seat.hand.map((r) => specOf(r).name).join(', ')}`"
      >
        <span
          v-for="(role, i) in seat.hand"
          :key="`hand-${role}-${i}`"
          data-slot="hand-card"
          class="relative block h-14 w-[2.375rem] shrink-0 overflow-hidden rounded-[0.3rem] ring-1 ring-foreground/15"
          :title="specOf(role).name"
        >
          <img :src="`/roles/${role}.webp`" :alt="specOf(role).name" class="size-full object-cover object-[50%_18%]">
        </span>
        <span v-if="seat.hand.length === 0" class="text-muted-foreground text-xs italic">no cards</span>
      </div>

      <div
        v-else
        class="flex items-end gap-1.5"
        :aria-label="`${seat.handCount} face-down cards`"
      >
        <span
          v-for="card in seat.handCount"
          :key="`hand-${card}`"
          data-slot="hand-back"
          class="flex h-14 w-[2.375rem] shrink-0 items-center justify-center rounded-[0.3rem] bg-neutral-900 text-neutral-500 ring-1 ring-black/40"
        >
          <span class="text-[0.5rem] font-semibold tracking-[0.2em]">G54</span>
        </span>
        <span v-if="seat.handCount === 0" class="text-muted-foreground text-xs italic">no cards</span>
      </div>

      <div
        v-if="seat.revealed.length > 0"
        class="flex items-end gap-1.5"
        :aria-label="`revealed ${revealedNames}`"
      >
        <span
          v-for="(role, i) in seat.revealed"
          :key="`rev-${role}-${i}`"
          data-slot="revealed-card"
          class="relative block h-14 w-[2.375rem] shrink-0 overflow-hidden rounded-[0.3rem] ring-1 ring-foreground/15 grayscale"
          :title="specOf(role).name"
        >
          <img :src="`/roles/${role}.webp`" :alt="specOf(role).name" class="size-full object-cover object-[50%_18%]">
        </span>
      </div>
    </div>

    <div v-if="seat.tokens.length > 0" class="flex flex-wrap items-center gap-1.5">
      <span
        v-for="token in seat.tokens"
        :key="token.id"
        class="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pe-2 ps-0.5 text-[0.6875rem] leading-none font-medium ring-1 ring-foreground/10"
      >
        <img v-if="token.art" :src="token.art" :alt="token.label" class="size-6 rounded-full object-cover">
        <Bomb v-else class="text-destructive size-4 ps-0.5" :aria-label="token.label" />
        {{ token.label }}
        <span v-if="token.detail" class="text-muted-foreground font-normal">
          {{ token.detail }}
        </span>
      </span>
    </div>
  </div>
</template>
