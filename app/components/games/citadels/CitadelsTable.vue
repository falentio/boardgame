<script setup lang="ts">
import { computed } from "vue";
import { PlayingCards, Trophy } from "@lucide/vue";
import DistrictCard from "./DistrictCard.vue";
import type { CastSlotState, CitadelsTable } from "@/composables/citadels-board.ts";
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts";

const props = defineProps<{ table: CitadelsTable }>();

const STATE_CLASS: Readonly<Record<CastSlotState, string>> = {
  available: "bg-muted/60 text-muted-foreground",
  mine: "bg-primary text-primary-foreground",
  faceup: "bg-card text-foreground ring-1 ring-foreground/20",
  pending: "bg-amber-500 text-black",
};

const castName = (character: CharacterId): string =>
  props.table.cast.find((slot) => slot.character === character)?.name ?? character;

const claim = computed(() => {
  const pending = props.table.pending;
  if (pending === null) return null;
  const who =
    pending.characterName === null
      ? `${pending.actorName} is acting`
      : `${pending.actorName} claims ${pending.characterName}`;
  const on = pending.targetName === null ? "" : ` on ${pending.targetName}`;
  const cards = pending.cards === 0 ? "" : ` · ${pending.cards} cards`;
  return `${who}${on}${cards}`;
});
</script>

<template>
  <section
    data-slot="citadels-table"
    class="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-xl border border-dashed border-foreground/15 bg-muted/30 p-3"
  >
    <div class="flex flex-col gap-1.5">
      <span
        class="text-[0.625rem] leading-none font-semibold tracking-[0.2em] text-muted-foreground uppercase"
      >
        Cast
      </span>
      <ul data-slot="citadels-cast" class="flex flex-wrap gap-1.5">
        <li
          v-for="slot in table.cast"
          :key="slot.character"
          data-slot="citadels-cast-chip"
          :data-character="slot.character"
          :data-state="slot.state"
          class="rounded-full px-2 py-0.5 text-[0.6875rem] leading-tight font-medium"
          :class="STATE_CLASS[slot.state]"
        >
          {{ slot.rank }} · {{ slot.name }}
        </li>
      </ul>
      <p
        v-if="table.myPick"
        data-slot="citadels-pick"
        class="text-xs leading-tight text-muted-foreground"
      >
        Your pick this round: {{ castName(table.myPick) }}
      </p>
    </div>

    <p
      v-if="table.window"
      data-slot="citadels-window"
      role="status"
      class="rounded-lg bg-card px-3 py-1.5 text-xs leading-tight font-medium ring-1 ring-foreground/10"
    >
      {{ table.window.label }}
      <span v-if="table.window.owedByMe" class="text-primary"> · you owe input</span>
    </p>
    <p v-if="claim" role="status" class="text-xs leading-tight text-muted-foreground">
      {{ claim }}
    </p>

    <p
      class="inline-flex items-center gap-1.5 text-xs leading-none text-muted-foreground tabular-nums"
    >
      <PlayingCards class="size-3.5" aria-hidden="true" />Deck {{ table.deckCount }}
    </p>

    <div v-if="table.discard.length > 0" class="flex flex-col gap-1.5">
      <span
        class="text-[0.625rem] leading-none font-semibold tracking-[0.2em] text-muted-foreground uppercase"
      >
        Discard
      </span>
      <ul data-slot="citadels-discard" class="flex flex-wrap gap-1.5">
        <li v-for="(district, index) in table.discard" :key="`${district}-${index}`">
          <DistrictCard :district="district" />
        </li>
      </ul>
    </div>

    <p
      v-if="table.winner"
      role="status"
      class="inline-flex items-center gap-1.5 self-start rounded-lg bg-primary/10 px-3 py-1.5 text-xs leading-tight font-semibold text-primary"
    >
      <Trophy class="size-3.5" aria-hidden="true" />{{ table.winner.name }} wins
    </p>
    <p
      v-else-if="table.terminal"
      role="status"
      class="self-start rounded-lg bg-primary/10 px-3 py-1.5 text-xs leading-tight font-semibold text-primary"
    >
      Game over
    </p>
  </section>
</template>
