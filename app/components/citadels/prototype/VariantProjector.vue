<script setup lang="ts">
/**
 * Variant 4, Projector: three columns, left to right.
 * Global third (cast, shown characters, discard), your board at two thirds, rivals listed on the right.
 */
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
  <div class="proto-root grid h-dvh min-h-0 w-full grid-cols-[1fr_2fr_15rem] overflow-hidden">
    <aside
      data-slot="v4-global"
      class="flex min-h-0 flex-col gap-3 overflow-y-auto border-r border-[var(--mk-line)] bg-[var(--mk-bg)] px-4 py-3"
    >
      <header class="flex items-baseline gap-2">
        <h2 class="text-lg font-semibold tracking-tight">Citadels</h2>
        <span class="font-mono text-[0.625rem] text-[var(--mk-comment)]">round 4</span>
      </header>

      <section class="flex flex-col gap-1.5">
        <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
          >Cast</span
        >
        <ul class="flex flex-col gap-1">
          <li
            v-for="id in b.cast"
            :key="id"
            class="flex items-center gap-2 rounded-md border px-2 py-1"
            :class="
              b.drafted.value === id
                ? 'border-[var(--mk-green)]/60 bg-[var(--mk-green)]/8'
                : 'border-[var(--mk-line)] bg-[var(--mk-panel)]/40'
            "
          >
            <span class="font-mono text-[0.625rem] tabular-nums text-[var(--mk-comment)]">{{
              String(b.roster.find((c) => c.id === id)?.rank ?? 0).padStart(2, "0")
            }}</span>
            <span class="flex-1 truncate text-xs font-medium">{{ characterName(id) }}</span>
            <ProtoChip v-if="b.drafted.value === id" tone="green">you</ProtoChip>
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-1.5">
        <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
          >Shown · pick one</span
        >
        <div class="grid grid-cols-2 gap-1.5">
          <button
            v-for="id in produced"
            :key="id"
            type="button"
            class="text-left"
            @click="pickDraft(id)"
          >
            <ProtoCharacter :id="id" :state="b.drafted.value === id ? 'mine' : 'faceup'" size="sm" />
          </button>
          <button
            v-for="id in b.cast.filter((c) => !produced.includes(c))"
            :key="id"
            type="button"
            class="text-left"
            @click="pickDraft(id)"
          >
            <ProtoCharacter :id="id" :state="b.drafted.value === id ? 'mine' : 'unknown'" size="sm" />
          </button>
        </div>
      </section>

      <section class="flex flex-col gap-1.5">
        <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
          >Discard</span
        >
        <div class="flex flex-wrap gap-1.5">
          <ProtoDistrict v-for="id in b.discarded" :key="id" :id="id" size="xs" compact dimmed />
        </div>
      </section>
    </aside>

    <main class="flex min-h-0 flex-col gap-3 overflow-y-auto px-6 py-3">
      <div class="flex shrink-0 items-center gap-1.5">
        <ProtoChip tone="orange">round 4</ProtoChip>
        <ProtoChip tone="green">build phase</ProtoChip>
        <ProtoChip v-if="b.drafted.value" tone="blue" class="ms-auto"
          >you hold {{ characterName(b.drafted.value) }}</ProtoChip
        >
      </div>

      <header v-rise class="flex items-baseline gap-4">
        <h2 class="text-4xl leading-none font-semibold tracking-tight">Your district</h2>
        <span class="font-mono text-2xl leading-none tabular-nums text-[var(--mk-yellow)]"
          >{{ b.gold.value }}<span class="text-sm">g</span></span
        >
        <span class="font-mono text-sm tabular-nums text-[var(--mk-comment)]"
          >{{ b.city.value.length }} of 8 districts</span
        >
      </header>

      <section v-rise="40" class="grid grid-cols-4 gap-2">
        <ProtoDistrict
          v-for="(card, index) in b.city.value"
          :key="`${card.id}-${index}`"
          :id="card.id"
          :gold="card.gold"
          size="lg"
          class="w-full"
        />
        <div
          v-for="n in Math.max(0, 8 - b.city.value.length)"
          :key="`gap-${n}`"
          class="flex h-14 items-center justify-center rounded-md border border-dashed border-[var(--mk-line)]/40 font-mono text-xs text-[var(--mk-comment)]/50"
        >
          +
        </div>
      </section>

      <section v-rise="80" class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <span
            class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
            >Hand</span
          >
          <button
            type="button"
            class="rounded-md border px-3 py-1.5 text-sm font-semibold"
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
        </div>
        <ul class="grid grid-cols-2 gap-1.5">
          <li v-for="id in b.hand.value" :key="id">
            <button type="button" class="block w-full" @click="b.selectCard(id)">
              <ProtoDistrict
                :id="id"
                size="md"
                class="w-full"
                :selected="b.selected.value === id"
              />
            </button>
          </li>
        </ul>
      </section>
    </main>

    <aside
      data-slot="v4-players"
      class="flex min-h-0 flex-col gap-2 overflow-y-auto border-l border-[var(--mk-line)] bg-[var(--mk-bg)] px-3 py-3"
    >
      <div class="flex items-baseline justify-between">
        <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
          >Players</span
        >
        <span class="font-mono text-[0.625rem] text-[var(--mk-comment)]">4</span>
      </div>

      <button
        v-for="seat in b.rivals"
        :key="seat.seat"
        type="button"
        class="flex flex-col gap-1.5 rounded-md border p-2.5 text-left transition-colors duration-150"
        :class="
          seat.city.length >= 7
            ? 'border-[var(--mk-green)]/50 bg-[var(--mk-green)]/6'
            : 'border-[var(--mk-line)] bg-[var(--mk-panel)]/40'
        "
        @click="b.focus(seat.seat)"
      >
        <span class="flex items-baseline gap-1.5">
          <span class="text-sm font-semibold">{{ seat.name }}</span>
          <ProtoChip v-if="seat.crown" tone="gold">crown</ProtoChip>
          <span class="ms-auto font-mono text-sm tabular-nums text-[var(--mk-yellow)]"
            >{{ seat.gold }}g</span
          >
        </span>
        <span class="font-mono text-[0.625rem] tabular-nums text-[var(--mk-comment)]">
          {{ seat.city.length }} of 8 · {{ seat.handCount }} in hand
        </span>
        <span class="flex gap-0.5">
          <span
            v-for="(card, index) in seat.city"
            :key="`${card.id}-${index}`"
            class="h-1.5 flex-1 rounded-full"
            :class="card.gold > 0 ? 'bg-[var(--mk-yellow)]' : 'bg-[var(--mk-comment)]/60'"
          />
          <span
            v-for="n in Math.max(0, 8 - seat.city.length)"
            :key="`e-${n}`"
            class="h-1.5 flex-1 rounded-full bg-[var(--mk-line)]/60"
          />
        </span>
        <span class="flex items-center gap-1">
          <ProtoChip v-if="seat.character" tone="blue">{{
            characterName(seat.character)
          }}</ProtoChip>
          <ProtoChip v-else>unknown</ProtoChip>
        </span>
      </button>
    </aside>
  </div>
</template>
