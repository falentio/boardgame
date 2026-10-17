<script setup lang="ts">
/** Variant 4, Projector: big type, one seat read large, everything else read at distance. */
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
  <div class="proto-root flex h-dvh min-h-0 w-full flex-col overflow-hidden">
    <header
      class="flex shrink-0 items-baseline gap-3 border-b border-[var(--mk-line)] px-6 py-3"
    >
      <h1 class="text-lg font-semibold tracking-tight">Citadels</h1>
      <span class="font-mono text-xs text-[var(--mk-comment)]">round 4 · build</span>
      <ProtoChip class="ms-auto" tone="green">you hold {{ characterName(b.drafted.value) }}</ProtoChip>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-[1fr_15rem] gap-0">
      <main class="flex min-h-0 flex-col gap-3 overflow-y-auto px-6 py-3">
        <header v-rise class="flex items-baseline gap-4">
          <h2 class="text-4xl leading-none font-semibold tracking-tight">
            {{ b.subject.value.name }}
          </h2>
          <span class="font-mono text-2xl leading-none tabular-nums text-[var(--mk-yellow)]"
            >{{ b.subject.value.gold }}<span class="text-sm">g</span></span
          >
          <span class="font-mono text-sm tabular-nums text-[var(--mk-comment)]"
            >{{ b.subject.value.city.length }} of 8 districts</span
          >
        </header>

        <section v-rise="40" class="grid grid-cols-4 gap-2">
          <ProtoDistrict
            v-for="(card, index) in b.subject.value.city"
            :key="`${card.id}-${index}`"
            :id="card.id"
            :gold="card.gold"
            size="lg"
            class="w-full"
          />
        </section>

        <div class="grid grid-cols-2 gap-4">
          <section v-rise="80" class="flex flex-col gap-2">
            <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
              >Hand</span
            >
            <ul class="grid grid-cols-1 gap-1.5">
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
          </section>

          <section v-rise="120" class="flex flex-col gap-2">
            <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
              >Characters</span
            >
            <div class="grid grid-cols-2 gap-1.5">
              <button
                v-for="id in produced"
                :key="id"
                type="button"
                class="text-left"
                @click="pickDraft(id)"
              >
                <ProtoCharacter :id="id" :state="b.drafted.value === id ? 'mine' : 'faceup'" />
              </button>
              <button
                v-for="id in b.cast.filter((c) => !produced.includes(c))"
                :key="id"
                type="button"
                class="text-left"
                @click="pickDraft(id)"
              >
                <ProtoCharacter :id="id" :state="b.drafted.value === id ? 'mine' : 'unknown'" />
              </button>
            </div>
          </section>
        </div>
      </main>

      <aside
        class="flex min-h-0 flex-col gap-1.5 overflow-y-auto border-l border-[var(--mk-line)] p-3"
      >
        <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
          >Seats</span
        >
        <button
          v-for="seat in b.rivals"
          :key="seat.seat"
          type="button"
          class="flex flex-col gap-1 rounded-md border p-2 text-left"
          :class="
            b.focused.value === seat.seat
              ? 'border-[var(--mk-yellow)] bg-[var(--mk-yellow)]/8'
              : 'border-[var(--mk-line)] bg-[var(--mk-panel)]/40'
          "
          @click="b.focus(seat.seat)"
        >
          <span class="flex items-baseline gap-1.5">
            <span class="text-sm font-semibold">{{ seat.name }}</span>
            <span class="ms-auto font-mono text-sm tabular-nums text-[var(--mk-yellow)]"
              >{{ seat.gold }}g</span
            >
          </span>
          <span class="font-mono text-[0.625rem] text-[var(--mk-comment)]">{{ seat.city.length }}/8</span>
          <span class="flex gap-0.5">
            <span
              v-for="(card, index) in seat.city"
              :key="`${card.id}-${index}`"
              class="h-1 flex-1 rounded-full bg-[var(--mk-comment)]/60"
            />
          </span>
        </button>
      </aside>
    </div>
  </div>
</template>
