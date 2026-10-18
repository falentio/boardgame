<script setup lang="ts">
import { computed } from "vue";
import { specOfCharacter } from "#shared/core/lockstep/games/citadels/index.ts";
import { defaultAvatarUrl } from "#shared/users/avatar.ts";
import { INCOME_GRANT_WORDS } from "@/composables/citadels-income-words.ts";
import type { CastSlot, CastSlotState, CitadelsBoard } from "@/composables/citadels-board.ts";
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts";
import "./citadels-skin.css";

const props = defineProps<{ board: CitadelsBoard }>();
const emit = defineEmits<{ pick: [character: CharacterId] }>();

const table = computed(() => props.board.table);

/** The emblem is the character itself, seeded by its id so it never moves. */
const emblemOf = (character: CharacterId): string => defaultAvatarUrl(character);

/** "gold / trade" — what the character pays per matching district, or null. */
const incomeOf = (character: CharacterId): string | null => {
  const spec = specOfCharacter(character);
  if (spec.income === null) return null;
  return `${INCOME_GRANT_WORDS[spec.income.grants.kind].bare} / ${spec.income.counts}`;
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
    class="flex min-h-0 min-w-0 flex-col gap-1 overflow-y-auto p-1 font-mono text-monokai-fg group-data-[orientation=landscape]/surface:h-full group-data-[orientation=landscape]/surface:w-full"
  >
    <header
      data-slot="citadels-global-plate"
      class="citadels-piece citadels-piece--thick flex items-stretch"
    >
      <span class="flex min-w-0 flex-1 items-baseline gap-1.5 px-2 py-1.5">
        <span data-slot="citadels-global-round" class="citadels-ink text-lg leading-none font-bold">{{ table.round }}</span>
        <span class="citadels-label">round</span>
        <span data-slot="citadels-global-title" class="citadels-label ms-auto">Citadels</span>
      </span>
      <span
        data-slot="citadels-global-phase"
        class="citadels-plate flex items-center px-2 text-[0.5625rem] leading-none font-bold tracking-[0.16em]"
        >{{ table.phaseLabel }}</span
      >
    </header>

    <p
      v-if="table.window"
      data-slot="citadels-prompt"
      class="border-s-2 border-s-monokai-green ps-1.5 text-[0.5625rem] leading-tight tracking-[0.16em] text-monokai-green uppercase"
    >
      {{ table.window.label }}
    </p>

    <section class="flex min-w-0 flex-col gap-1">
      <span class="citadels-label">Cast</span>
      <ul data-slot="citadels-cast" class="flex min-w-0 flex-col gap-1">
        <li v-for="slot in table.cast" :key="slot.character" class="min-w-0">
          <component
            :is="pickable(slot) ? 'button' : 'div'"
            :type="pickable(slot) ? 'button' : undefined"
            data-slot="citadels-cast-row"
            :data-character="slot.character"
            :data-state="slot.state"
            :style="{ '--ink': INK[slot.state] }"
            :aria-label="`${slot.name}, ${FLAG[slot.state]}${pickable(slot) ? ', pick' : ''}`"
            class="citadels-piece citadels-piece--thick flex w-full flex-1 items-stretch overflow-hidden text-left"
            :class="pickable(slot) ? 'cursor-pointer' : ''"
            @click="pick(slot)"
          >
            <span
              data-slot="citadels-cast-emblem"
              class="m-1.5 flex size-7 shrink-0 items-center justify-center overflow-hidden bg-monokai-bg"
            >
              <img :src="emblemOf(slot.character)" alt="" class="size-6 object-cover" />
            </span>
            <span class="flex min-w-0 flex-1 flex-col justify-center gap-1 py-1.5 pe-1.5">
              <span class="text-[0.6875rem] leading-none font-bold tracking-[0.03em] uppercase [overflow-wrap:anywhere]">{{
                slot.name
              }}</span>
              <span v-if="incomeOf(slot.character)" class="min-w-0">
                <span class="citadels-label !text-[0.5rem]">{{ incomeOf(slot.character) }}</span>
              </span>
            </span>
            <span
              data-slot="citadels-cast-flag"
              class="citadels-plate m-1.5 flex w-[48px] shrink-0 items-center justify-center"
              :style="{ '--plate-ink': INK[slot.state] }"
            >
              <span class="text-[0.5rem] leading-none font-bold tracking-[0.14em]">{{
                FLAG[slot.state]
              }}</span>
            </span>
          </component>
        </li>
      </ul>
    </section>

    <section class="flex items-stretch gap-1 border-t border-t-monokai-line pt-1">
      <span
        data-slot="citadels-deck"
        class="citadels-piece flex flex-1 items-center justify-between px-1.5 py-1"
      >
        <span class="citadels-label">deck</span>
        <span class="citadels-ink text-xs leading-none font-bold">{{ table.deckCount }}</span>
      </span>
      <span
        data-slot="citadels-discard-count"
        class="citadels-piece flex flex-1 items-center justify-between px-1.5 py-1"
      >
        <span class="citadels-label">discard</span>
        <span class="citadels-ink text-xs leading-none font-bold">{{ table.discard.length }}</span>
      </span>
    </section>

    <section class="flex min-w-0 flex-col gap-1">
      <span class="citadels-label">Discard</span>
      <ul class="flex flex-wrap gap-1">
        <li
          v-for="(district, index) in table.discard"
          :key="`${district}-${index}`"
          class="citadels-piece px-1 py-0.5 text-[0.5625rem] leading-[1.25] whitespace-nowrap text-monokai-comment"
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
