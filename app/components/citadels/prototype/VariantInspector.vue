<script setup lang="ts">
/** Variant 1, Inspector: shared table pinned on the left third, the focused seat on the right two thirds. */
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts"
import { characterName, createPrototypeBoard } from "./use-board"
import { vRise } from "./v-rise"
import ProtoCharacter from "./ProtoCharacter.vue"
import ProtoChip from "./ProtoChip.vue"
import ProtoDistrict from "./ProtoDistrict.vue"
import ProtoSeatStrip from "./ProtoSeatStrip.vue"

const b = createPrototypeBoard()

const produced = b.produced as readonly CharacterId[]
const canBuild = () => b.selected.value !== null
const pickDraft = (id: CharacterId) => b.draft(id)
const buy = () => {
  const id = b.selected.value
  if (id !== null) b.build(id)
}
</script>

<template>
  <div class="proto-root flex h-dvh min-h-0 w-full overflow-hidden">
    <aside
      data-slot="v1-shared"
      class="flex w-1/3 min-w-[17rem] max-w-[24rem] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[var(--mk-line)] p-3"
    >
      <header class="flex items-baseline justify-between">
        <h2 class="text-sm font-semibold tracking-tight">The table</h2>
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
            class="flex items-center gap-2 rounded-md border px-2 py-1.5"
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
          >Discard</span
        >
        <div class="flex flex-wrap gap-1.5">
          <ProtoDistrict v-for="id in b.discarded" :key="id" :id="id" size="xs" compact dimmed />
        </div>
      </section>

      <section class="flex flex-col gap-1.5">
        <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
          >Rivals</span
        >
        <ProtoSeatStrip
          v-for="seat in b.rivals"
          :key="seat.seat"
          :seat="seat"
          :focused="b.focused.value === seat.seat"
          vertical
          dense
          @pick="b.focus(seat.seat)"
        />
      </section>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div class="flex shrink-0 items-center gap-1.5 border-b border-[var(--mk-line)] px-3 py-2">
        <button
          type="button"
          class="rounded-md border px-2.5 py-1 text-xs font-semibold"
          :class="
            b.focused.value === 'you'
              ? 'border-[var(--mk-yellow)] bg-[var(--mk-yellow)]/10 text-[var(--mk-yellow)]'
              : 'border-[var(--mk-line)] text-[var(--mk-comment)]'
          "
          @click="b.focus('you')"
        >
          You
        </button>
        <button
          v-for="seat in b.rivals"
          :key="seat.seat"
          type="button"
          class="rounded-md border px-2.5 py-1 text-xs font-medium"
          :class="
            b.focused.value === seat.seat
              ? 'border-[var(--mk-yellow)] bg-[var(--mk-yellow)]/10 text-[var(--mk-yellow)]'
              : 'border-[var(--mk-line)] text-[var(--mk-comment)]'
          "
          @click="b.focus(seat.seat)"
        >
          {{ seat.name }}
        </button>
        <ProtoChip class="ms-auto" tone="orange">build phase</ProtoChip>
      </div>

      <div class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <header v-rise class="flex items-end justify-between gap-3">
          <div class="flex flex-col gap-1">
            <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
              >{{ b.focused.value === "you" ? "Your district" : "Rival district" }}</span
            >
            <h1 class="text-2xl leading-none font-semibold tracking-tight">
              {{ b.subject.value.name }}
            </h1>
          </div>
          <div class="flex items-center gap-3 font-mono text-xs tabular-nums">
            <span class="text-[var(--mk-yellow)]">{{ b.subject.value.gold }}g</span>
            <span class="text-[var(--mk-comment)]"
              >{{ b.subject.value.city.length }}<span class="opacity-60">/8</span></span
            >
            <ProtoChip v-if="b.subject.value.character" tone="blue">{{
              characterName(b.subject.value.character)
            }}</ProtoChip>
          </div>
        </header>

        <section v-rise="40" class="flex flex-col gap-1.5">
          <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
            >City</span
          >
          <div
            class="grid grid-cols-2 gap-1.5 rounded-lg border border-[var(--mk-line)] bg-[var(--mk-panel)]/40 p-2 sm:grid-cols-3"
          >
            <ProtoDistrict
              v-for="(card, index) in b.subject.value.city"
              :key="`${card.id}-${index}`"
              :id="card.id"
              :gold="card.gold"
              size="md"
            />
            <div
              v-if="b.subject.value.city.length === 0"
              class="col-span-full py-6 text-center text-xs text-[var(--mk-comment)] italic"
            >
              no districts yet
            </div>
          </div>
        </section>

        <template v-if="b.focused.value === 'you'">
          <section v-rise="80" class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between">
              <span
                class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
                >Hand ({{ b.hand.value.length }})</span
              >
              <button
                type="button"
                class="rounded-md border px-2.5 py-1 text-xs font-semibold"
                :class="
                  canBuild()
                    ? 'border-[var(--mk-green)] bg-[var(--mk-green)]/12 text-[var(--mk-green)]'
                    : 'border-[var(--mk-line)] text-[var(--mk-comment)]'
                "
                :disabled="!canBuild()"
                @click="buy"
              >
                Build
              </button>
            </div>
            <ul class="grid grid-cols-2 gap-1.5 lg:grid-cols-3">
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

          <section v-rise="120" class="flex flex-col gap-1.5">
            <span class="font-mono text-[0.5625rem] tracking-[0.16em] text-[var(--mk-comment)] uppercase"
              >Shown characters · pick one</span
            >
            <div class="grid grid-cols-2 gap-1.5 xl:grid-cols-4">
              <button
                v-for="id in produced"
                :key="id"
                type="button"
                class="text-left"
                @click="pickDraft(id)"
              >
                <ProtoCharacter
                  :id="id"
                  :state="b.drafted.value === id ? 'mine' : 'faceup'"
                  size="sm"
                />
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
        </template>

        <p v-else class="text-xs text-[var(--mk-comment)]">
          Reading {{ b.subject.value.name }}'s city. Pick your own seat to act.
        </p>
      </div>
    </main>
  </div>
</template>
