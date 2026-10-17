<script setup lang="ts">
/** Variant 3, Wall: nothing swaps. Every city is a column you can read at once, yours built up on the right. */
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts"
import { characterName, createPrototypeBoard } from "./use-board"
import { vRise } from "./v-rise"
import ProtoChip from "./ProtoChip.vue"
import ProtoDistrict from "./ProtoDistrict.vue"

const b = createPrototypeBoard()

const produced = b.produced as readonly CharacterId[]
const pickDraft = (id: CharacterId) => b.draft(id)
const buy = () => {
  const id = b.selected.value
  if (id !== null) b.build(id)
}
</script>

<template>
  <div class="proto-root flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-[var(--mk-bg)]">
    <header class="flex shrink-0 items-center gap-2 border-b border-[var(--mk-line)] px-3 py-2">
      <ProtoChip tone="orange">round 4</ProtoChip>
      <span class="font-mono text-[0.625rem] text-[var(--mk-comment)]">every city on one wall</span>
      <div class="ms-auto flex items-center gap-1.5">
        <span class="font-mono text-[0.625rem] text-[var(--mk-comment)]">your pick</span>
        <button
          v-for="id in produced"
          :key="id"
          type="button"
          class="rounded-md border px-2 py-1 font-mono text-[0.625rem]"
          :class="
            b.drafted.value === id
              ? 'border-[var(--mk-green)] text-[var(--mk-green)]'
              : 'border-[var(--mk-line)] text-[var(--mk-comment)]'
          "
          @click="pickDraft(id)"
        >
          {{ characterName(id) }}
        </button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1 gap-2 overflow-x-auto p-2">
      <section
        v-for="seat in b.rivals"
        :key="seat.seat"
        v-rise
        class="flex w-40 shrink-0 flex-col gap-1.5 rounded-lg border p-2"
        :class="
          seat.city.length >= 7
            ? 'border-[var(--mk-green)]/50 bg-[var(--mk-green)]/6'
            : 'border-[var(--mk-line)] bg-[var(--mk-panel)]/40'
        "
      >
        <header class="flex flex-col gap-1">
          <span class="flex items-center gap-1">
            <span class="truncate text-xs font-semibold">{{ seat.name }}</span>
            <ProtoChip v-if="seat.crown" tone="gold">crown</ProtoChip>
          </span>
          <span class="flex items-center gap-2 font-mono text-[0.625rem] tabular-nums">
            <span class="text-[var(--mk-yellow)]">{{ seat.gold }}g</span>
            <span class="text-[var(--mk-comment)]">{{ seat.city.length }}/8</span>
            <span class="text-[var(--mk-comment)]">{{ seat.handCount }} hand</span>
          </span>
          <ProtoChip v-if="seat.character" tone="blue">{{ characterName(seat.character) }}</ProtoChip>
          <ProtoChip v-else>unknown character</ProtoChip>
        </header>
        <ul class="flex flex-col gap-0.5">
          <li v-for="(card, index) in seat.city" :key="`${card.id}-${index}`">
            <ProtoDistrict :id="card.id" :gold="card.gold" size="xxs" class="w-full" />
          </li>
          <li
            v-for="n in Math.max(0, 8 - seat.city.length)"
            :key="`gap-${n}`"
            class="h-5 rounded-md border border-dashed border-[var(--mk-line)]/50"
          />
        </ul>
      </section>

      <section
        v-rise="60"
        class="flex w-72 shrink-0 flex-col gap-1.5 rounded-lg border border-[var(--mk-yellow)]/40 bg-[var(--mk-panel)] p-2"
      >
        <header class="flex items-center gap-2">
          <span class="text-xs font-semibold text-[var(--mk-yellow)]">You</span>
          <span class="font-mono text-xs tabular-nums text-[var(--mk-yellow)]">{{ b.gold.value }}g</span>
          <span class="font-mono text-[0.625rem] tabular-nums text-[var(--mk-comment)]"
            >{{ b.city.value.length }}/8</span
          >
          <button
            type="button"
            class="ms-auto rounded-md border px-2 py-1 text-xs font-semibold"
            :class="
              b.selected.value === null
                ? 'border-[var(--mk-line)] text-[var(--mk-comment)]'
                : 'border-[var(--mk-green)] bg-[var(--mk-green)]/12 text-[var(--mk-green)]'
            "
            :disabled="b.selected.value === null"
            @click="buy"
          >
            Build
          </button>
        </header>
        <ProtoChip v-if="b.drafted.value" tone="blue" class="self-start">{{
          characterName(b.drafted.value)
        }}</ProtoChip>

        <ul class="flex flex-col gap-0.5">
          <li v-for="(card, index) in b.city.value" :key="`${card.id}-${index}`">
            <ProtoDistrict :id="card.id" :gold="card.gold" size="xs" class="w-full" />
          </li>
        </ul>

        <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
          >Hand</span
        >
        <ul class="flex flex-col gap-0.5">
          <li v-for="id in b.hand.value" :key="id">
            <button type="button" class="block w-full" @click="b.selectCard(id)">
              <ProtoDistrict
                :id="id"
                size="xxs"
                class="w-full"
                :selected="b.selected.value === id"
              />
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
