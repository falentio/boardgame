<script setup lang="ts">
/** Variant 2, Table: the round table is the screen. Rival rings wrap it, your board sits under it. */
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts"
import { characterName, createPrototypeBoard } from "./use-board"
import { vRise } from "./v-rise"
import ProtoCharacter from "./ProtoCharacter.vue"
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
    <div class="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
      <section v-rise class="flex w-full flex-col gap-2">
        <div class="flex w-full items-center gap-1.5">
          <ProtoChip tone="orange">round 4</ProtoChip>
          <ProtoChip tone="green">draft</ProtoChip>
          <span class="ms-auto font-mono text-[0.625rem] text-[var(--mk-comment)]"
            >crown · {{ b.rivals.find((s) => s.crown)?.name }}</span
          >
        </div>

        <ul class="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-4">
          <li v-for="seat in b.rivals" :key="seat.seat">
            <button
              type="button"
              class="flex w-full flex-col gap-1 rounded-lg border p-2 text-left"
              :class="
                b.focused.value === seat.seat
                  ? 'border-[var(--mk-yellow)] bg-[var(--mk-yellow)]/8'
                  : 'border-[var(--mk-line)] bg-[var(--mk-panel)]/50'
              "
              @click="b.focus(seat.seat)"
            >
              <span class="flex items-center gap-1.5">
                <span class="truncate text-xs font-semibold">{{ seat.name }}</span>
                <ProtoChip v-if="seat.crown" tone="gold">crown</ProtoChip>
              </span>
              <span class="font-mono text-[0.625rem] tabular-nums text-[var(--mk-comment)]">
                {{ seat.gold }}g · {{ seat.city.length }}/8 · {{ seat.handCount }} in hand
              </span>
              <span class="flex gap-1">
                <span
                  v-for="(card, index) in seat.city.slice(0, 8)"
                  :key="`${card.id}-${index}`"
                  class="h-1 flex-1 rounded-full"
                  :class="
                    card.gold > 0
                      ? 'bg-[var(--mk-yellow)]'
                      : seat.city.length >= 7
                        ? 'bg-[var(--mk-green)]'
                        : 'bg-[var(--mk-comment)]/50'
                  "
                />
                <span
                  v-for="n in Math.max(0, 8 - seat.city.length)"
                  :key="`e-${n}`"
                  class="h-1 flex-1 rounded-full bg-[var(--mk-line)]/60"
                />
              </span>
              <span class="flex items-center gap-1">
                <ProtoChip v-if="seat.character" tone="blue">{{
                  characterName(seat.character)
                }}</ProtoChip>
                <ProtoChip v-else>unknown</ProtoChip>
              </span>
            </button>
          </li>
        </ul>

        <div
          class="flex w-full flex-col gap-2 rounded-xl border border-dashed border-[var(--mk-line)] bg-[var(--mk-panel)]/30 p-3"
        >
          <div class="flex items-center gap-2">
            <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
              >Cast</span
            >
            <span class="font-mono text-[0.625rem] text-[var(--mk-comment)]">the table</span>
          </div>
          <div class="grid grid-cols-4 gap-1.5 lg:grid-cols-8">
            <button
              v-for="id in b.cast"
              :key="id"
              type="button"
              class="text-left"
              @click="pickDraft(id)"
            >
              <ProtoCharacter
                :id="id"
                size="sm"
                :state="
                  b.drafted.value === id
                    ? 'mine'
                    : produced.includes(id)
                      ? 'faceup'
                      : 'unknown'
                "
              />
            </button>
          </div>
        </div>
      </section>

      <section
        v-rise="60"
        data-slot="v2-mine"
        class="flex w-full flex-col gap-2 rounded-xl border border-[var(--mk-line)] bg-[var(--mk-panel)]/50 p-3"
      >
        <header class="flex items-center gap-2">
          <h1 class="text-sm font-semibold">Your district</h1>
          <span class="font-mono text-xs tabular-nums text-[var(--mk-yellow)]">{{ b.gold.value }}g</span>
          <span class="font-mono text-xs tabular-nums text-[var(--mk-comment)]"
            >{{ b.city.value.length }}/8</span
          >
          <ProtoChip v-if="b.drafted.value" tone="blue">{{ characterName(b.drafted.value) }}</ProtoChip>
          <button
            type="button"
            class="ms-auto rounded-md border px-2.5 py-1 text-xs font-semibold"
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

        <div class="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
          <ProtoDistrict
            v-for="(card, index) in b.city.value"
            :key="`${card.id}-${index}`"
            :id="card.id"
            :gold="card.gold"
            class="w-full"
          />
          <div
            v-for="n in Math.max(0, 8 - b.city.value.length)"
            :key="`gap-${n}`"
            class="flex h-8 items-center justify-center rounded-md border border-dashed border-[color-mix(in_srgb,var(--mk-line)_60%,transparent)] font-mono text-[0.625rem] text-[var(--mk-comment)]/60"
          >
            +
          </div>
        </div>

        <div class="flex items-end gap-1.5 overflow-x-auto pb-1">
          <button
            v-for="id in b.hand.value"
            :key="id"
            type="button"
            class="shrink-0 transition-transform duration-150 ease-out active:scale-[0.97]"
            :class="b.selected.value === id && '-translate-y-1'"
            @click="b.selectCard(id)"
          >
            <ProtoDistrict :id="id" size="md" :selected="b.selected.value === id" />
          </button>
          <span
            v-if="b.hand.value.length === 0"
            class="text-xs text-[var(--mk-comment)] italic"
            >hand empty</span
          >
        </div>
      </section>
    </div>
  </div>
</template>
