<script setup lang="ts">
import { computed } from "vue";
import { PlayingCards } from "@lucide/vue";
import CharacterCard from "../CharacterCard.vue";
import DistrictCard from "../DistrictCard.vue";
import type { CastSlotState, CitadelsBoard } from "@/composables/citadels-board.ts";
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts";

const props = defineProps<{ board: CitadelsBoard }>();
defineEmits<{ pick: [character: CharacterId] }>();

const STATE_CLASS: Readonly<Record<CastSlotState, string>> = {
  available: "bg-muted text-muted-foreground",
  mine: "bg-primary text-primary-foreground",
  faceup: "bg-card text-foreground ring-1 ring-foreground/20",
  pending: "bg-amber-500 text-black",
};

const PICKABLE: Readonly<Record<CastSlotState, boolean>> = {
  available: true,
  mine: false,
  faceup: true,
  pending: false,
};

const table = computed(() => props.board.table);
const faceupIds = computed(
  () => new Set(table.value.cast.filter((s) => s.state === "faceup").map((s) => s.character)),
);
const pickable = (state: CastSlotState) => PICKABLE[state] && table.value.window?.owedByMe === true;
const rankOf = (character: CharacterId): string =>
  String(table.value.cast.find((slot) => slot.character === character)?.rank ?? 0).padStart(2, "0");

const pickLine = computed(() => (table.value.window?.owedByMe === true ? "Shown · pick one" : "Shown"));
</script>

<template>
  <aside
    data-slot="citadels-global"
    class="flex min-h-0 flex-col gap-3 overflow-y-auto group-data-[orientation=landscape]/surface:h-full group-data-[orientation=landscape]/surface:rounded-xl group-data-[orientation=landscape]/surface:bg-muted/20 group-data-[orientation=landscape]/surface:p-3 group-data-[orientation=landscape]/surface:ring-1 group-data-[orientation=landscape]/surface:ring-foreground/10"
  >
    <div class="flex items-baseline gap-2">
      <h2 class="text-lg leading-none font-semibold tracking-tight">Citadels</h2>
      <span class="text-[0.625rem] leading-none text-muted-foreground tabular-nums"
        >round {{ table.round }}</span
      >
    </div>

    <section class="flex flex-col gap-1.5">
      <span
        class="text-[0.625rem] leading-none font-semibold tracking-[0.2em] text-muted-foreground uppercase"
        >Cast</span
      >
      <ul data-slot="citadels-cast" class="flex flex-col gap-1">
        <li
          v-for="slot in table.cast"
          :key="slot.character"
          data-slot="citadels-cast-chip"
          :data-character="slot.character"
          :data-state="slot.state"
          class="flex items-center gap-2 rounded-md bg-card px-2 py-1 text-xs leading-none"
          :class="slot.state === 'mine' ? 'ring-1 ring-primary' : 'ring-1 ring-foreground/10'"
        >
          <span class="text-[0.625rem] text-muted-foreground tabular-nums">{{
            String(slot.rank).padStart(2, "0")
          }}</span>
          <span class="min-w-0 flex-1 truncate font-medium">{{ slot.name }}</span>
          <span
            v-if="slot.state !== 'available'"
            class="shrink-0 rounded-full px-1.5 py-0.5 text-[0.625rem] leading-none font-semibold"
            :class="STATE_CLASS[slot.state]"
            >{{ slot.state === "mine" ? "you" : slot.state }}</span
          >
        </li>
      </ul>
    </section>

    <section class="flex flex-col gap-1.5">
      <span
        class="text-[0.625rem] leading-none font-semibold tracking-[0.2em] text-muted-foreground uppercase"
        >{{ pickLine }}</span
      >
      <div class="grid grid-cols-2 gap-1.5">
        <CharacterCard
          v-for="slot in table.cast.filter((s) => faceupIds.has(s.character))"
          :key="slot.character"
          data-slot="citadels-faceup"
          :character="slot.character"
          :selectable="pickable(slot.state)"
          :selected="slot.state === 'mine'"
          :class="!pickable(slot.state) && 'max-h-40'"
          @select="$emit('pick', slot.character)"
        />
        <p
          v-if="faceupIds.size === 0"
          class="text-xs leading-tight text-muted-foreground italic"
        >
          none shown this round
        </p>
      </div>
    </section>

    <p
      class="inline-flex items-center gap-1.5 text-xs leading-none text-muted-foreground tabular-nums"
    >
      <PlayingCards class="size-3.5" aria-hidden="true" />Deck {{ table.deckCount }}
    </p>

    <section class="flex flex-col gap-1.5">
      <span
        class="text-[0.625rem] leading-none font-semibold tracking-[0.2em] text-muted-foreground uppercase"
        >Discard</span
      >
      <ul data-slot="citadels-discard" class="flex flex-wrap gap-1.5">
        <li v-for="(district, index) in table.discard" :key="`${district}-${index}`">
          <DistrictCard :district="district" />
        </li>
        <li
          v-if="table.discard.length === 0"
          class="text-xs leading-tight text-muted-foreground italic"
        >
          nothing discarded yet
        </li>
      </ul>
    </section>
  </aside>
</template>
