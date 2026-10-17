<script setup lang="ts">
import type { ProtoSeat } from "./use-board"
import { characterName } from "./use-board"
import ProtoChip from "./ProtoChip.vue"

withDefaults(
  defineProps<{
    seat: ProtoSeat
    focused: boolean
    vertical?: boolean
    dense?: boolean
  }>(),
  { vertical: false, dense: false },
)

defineEmits<{ pick: [] }>()
</script>

<template>
  <button
    type="button"
    data-seat-strip
    :data-seat="seat.seat"
    :data-focused="focused"
    class="group/seat flex min-w-0 cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-[border-color,background-color] duration-150 ease-out"
    :class="[
      focused
        ? 'border-[var(--mk-yellow)] bg-[var(--mk-yellow)]/8'
        : 'border-[var(--mk-line)] bg-[var(--mk-panel)]/50 hover:border-[var(--mk-comment)] hover:bg-[var(--mk-panel)]',
      vertical && 'w-full',
    ]"
    @click="$emit('pick')"
  >
    <span
      class="flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[0.625rem] font-semibold"
      :class="
        focused
          ? 'border-[var(--mk-yellow)] text-[var(--mk-yellow)]'
          : 'border-[var(--mk-line)] text-[var(--mk-comment)]'
      "
    >
      {{ seat.name.slice(0, 1) }}
    </span>
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="flex min-w-0 items-center gap-1.5">
        <span class="truncate text-xs font-semibold text-[var(--mk-fg)]">{{ seat.name }}</span>
        <ProtoChip v-if="seat.crown" tone="gold">crown</ProtoChip>
        <ProtoChip v-if="seat.worn" tone="blue">{{ characterName(seat.character) }}</ProtoChip>
      </span>
      <span
        v-if="!dense"
        class="flex items-center gap-2 font-mono text-[0.625rem] leading-none tabular-nums text-[var(--mk-comment)]"
      >
        <span class="text-[var(--mk-yellow)]">{{ seat.gold }}g</span>
        <span>{{ seat.city.length }}/8</span>
        <span>{{ seat.handCount }} in hand</span>
      </span>
    </span>
    <span
      class="font-mono text-[0.625rem] tabular-nums"
      :class="seat.city.length >= 7 ? 'text-[var(--mk-green)]' : 'text-[var(--mk-comment)]'"
    >
      {{ seat.city.length }}<span class="opacity-50">/8</span>
    </span>
  </button>
</template>
