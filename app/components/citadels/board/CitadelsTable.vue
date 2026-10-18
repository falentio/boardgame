<script setup lang="ts">
import { computed } from "vue";
import { specOfCharacter } from "#shared/core/lockstep/games/citadels/index.ts";
import { defaultAvatarUrl } from "#shared/users/avatar.ts";
import type { CastSlot, CastSlotState, CitadelsBoard } from "@/composables/citadels-board.ts";
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts";

const props = defineProps<{ board: CitadelsBoard }>();
const emit = defineEmits<{ pick: [character: CharacterId] }>();

const table = computed(() => props.board.table);

/** The emblem is the character itself, seeded by its id so it never moves. */
const emblemOf = (character: CharacterId): string => defaultAvatarUrl(character);

const GRANT: Readonly<Record<"gold" | "cards" | "gold-or-cards", string>> = {
  gold: "gold",
  cards: "card",
  "gold-or-cards": "gold or card",
};

/** "gold / trade" — what the character pays per matching district, or null. */
const incomeOf = (character: CharacterId): string | null => {
  const spec = specOfCharacter(character);
  if (spec.income === null) return null;
  return `${GRANT[spec.income.grants.kind]} / ${spec.income.counts}`;
};

/** The one word a row is flagged with, in the state's own ink. */
const FLAG: Readonly<Record<CastSlotState, string>> = {
  mine: "yours",
  pending: "claims",
  faceup: "shown",
  available: "open",
};

const INK: Readonly<Record<CastSlotState, string>> = {
  mine: "var(--monokai-green)",
  pending: "var(--monokai-pink)",
  faceup: "var(--monokai-blue)",
  available: "var(--monokai-line)",
};

/** A shown or available rank can be picked while the viewer owes a pick. */
const pickable = (slot: CastSlot): boolean =>
  table.value.window?.owedByMe === true && (slot.state === "faceup" || slot.state === "available");

const pick = (slot: CastSlot): void => {
  if (!pickable(slot)) return;
  emit("pick", slot.character);
};
</script>
<template>
  <aside
    data-slot="citadels-global"
    class="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-y-auto p-2 font-mono text-monokai-fg group-data-[orientation=landscape]/surface:h-full group-data-[orientation=landscape]/surface:w-full"
  >
    <header class="flex items-baseline justify-between gap-2">
      <h2 class="text-sm leading-none font-bold tracking-[0.18em] uppercase">Citadels</h2>
      <span class="text-[0.5625rem] leading-none tracking-[0.16em] text-monokai-comment uppercase tabular-nums">
        round {{ table.round }}
      </span>
    </header>

    <p
      v-if="table.window"
      data-slot="citadels-prompt"
      class="text-[0.5625rem] leading-tight tracking-[0.16em] text-monokai-green uppercase"
    >
      {{ table.window.label }}
    </p>

    <section class="flex min-w-0 flex-col gap-1">
      <span class="text-[0.5625rem] leading-none tracking-[0.16em] text-monokai-comment uppercase"
        >Cast</span
      >
      <ul data-slot="citadels-cast" class="flex min-w-0 flex-col gap-1">
        <li v-for="slot in table.cast" :key="slot.character" class="min-w-0">
          <component
            :is="pickable(slot) ? 'button' : 'div'"
            :type="pickable(slot) ? 'button' : undefined"
            data-slot="citadels-cast-row"
            :data-character="slot.character"
            :data-state="slot.state"
            :aria-label="`${slot.name}, ${FLAG[slot.state]}${pickable(slot) ? ', pick' : ''}`"
            class="flex w-full flex-1 items-stretch overflow-hidden text-left"
            :class="pickable(slot) ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-monokai-yellow' : ''"
            @click="pick(slot)"
          >
            <span data-slot="citadels-cast-emblem" class="relative aspect-square h-[9%] max-h-[70px] shrink-0 bg-monokai-bg">
              <img :src="emblemOf(slot.character)" alt="" class="size-full object-cover" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col justify-center gap-1 px-1.5">
              <span class="truncate text-[0.6875rem] leading-none font-bold tracking-[0.03em] uppercase">{{
                slot.name
              }}</span>
              <span class="flex min-w-0 items-center gap-1">
                <span class="h-[3px] w-3.5 shrink-0" :style="{ background: INK[slot.state] }" />
                <span
                  v-if="incomeOf(slot.character)"
                  class="min-w-0 truncate text-[0.5625rem] leading-none tracking-[0.16em] text-monokai-comment uppercase"
                  >{{ incomeOf(slot.character) }}</span
                >
              </span>
            </span>
            <span
              data-slot="citadels-cast-flag"
              class="flex w-[46px] shrink-0 items-center justify-center"
              :style="{ background: INK[slot.state] }"
            >
              <span class="text-[0.5625rem] leading-none tracking-[0.16em] text-monokai-bg uppercase">{{
                FLAG[slot.state]
              }}</span>
            </span>
          </component>
        </li>
      </ul>
    </section>

    <section class="flex items-baseline justify-between gap-2 border-t border-t-monokai-line pt-1.5">
      <span class="text-[0.5625rem] leading-none tracking-[0.16em] text-monokai-comment uppercase tabular-nums"
        >deck {{ table.deckCount }}</span
      >
      <span class="text-[0.5625rem] leading-none tracking-[0.16em] text-monokai-comment uppercase tabular-nums"
        >discard {{ table.discard.length }}</span
      >
    </section>

    <section class="flex min-w-0 flex-col gap-1">
      <span class="text-[0.5625rem] leading-none tracking-[0.16em] text-monokai-comment uppercase"
        >Discard</span
      >
      <ul class="flex flex-wrap gap-1">
        <li
          v-for="(district, index) in table.discard"
          :key="`${district}-${index}`"
          class="border border-monokai-line px-1 text-[0.5625rem] leading-[1.25] whitespace-nowrap text-monokai-comment"
        >
          {{ district }}
        </li>
        <li v-if="table.discard.length === 0" class="text-[0.5625rem] text-monokai-comment">
          nothing discarded
        </li>
      </ul>
    </section>
  </aside>
</template>