<script setup lang="ts">
import type { RoomSetup } from "#shared/rooms/games.ts"
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts"
import { computed, ref } from "vue"
import CharacterCard from "@/components/citadels/CharacterCard.vue"
import { ROLE_STRIP_CLASS, ROLE_STRIP_CARD_CLASS } from "@/composables/card-shell"
import {
  byRank,
  completeCast,
  defaultCast,
  missingRanks,
  pickCharacter,
  type CastDraft,
} from "@/composables/cast"

defineProps<{ setup: RoomSetup | null }>()

const emit = defineEmits<{
  change: [setup: RoomSetup | null, missing: readonly string[]]
}>()

const draft = ref<CastDraft>(defaultCast())

const required = computed(
  () => byRank.filter((group) => group.rank <= 8 && draft.value[group.rank] !== null).length,
)
const hasNinth = computed(() => draft.value[9] !== null)

const announce = (next: CastDraft) => {
  draft.value = next
  const cast = completeCast(next)
  emit(
    "change",
    cast === null ? null : { game: "citadels", cast },
    missingRanks(next).map((rank) => `Rank ${String(rank)}`),
  )
}

const choose = (character: CharacterId) => announce(pickCharacter(draft.value, character))
</script>

<template>
  <div class="flex flex-col gap-5">
    <p class="text-sm leading-none font-medium tabular-nums">
      {{ required }} of 8 chosen
      <span v-if="hasNinth" class="text-muted-foreground">· +1 optional</span>
    </p>

    <div
      v-for="group in byRank"
      :key="group.rank"
      role="group"
      :aria-labelledby="`cast-rank-${String(group.rank)}`"
      class="flex flex-col gap-2"
    >
      <p :id="`cast-rank-${String(group.rank)}`" class="text-sm leading-none font-medium">
        Rank {{ group.rank }}
        <span v-if="group.rank === 9" class="text-muted-foreground">· optional</span>
      </p>

      <div data-slot="role-strip" :class="ROLE_STRIP_CLASS">
        <CharacterCard
          v-for="character in group.characters"
          :key="character.id"
          :character="character.id"
          :class="ROLE_STRIP_CARD_CLASS"
          selectable
          :selected="draft[group.rank] === character.id"
          data-setup-option
          @select="choose(character.id)"
        />
      </div>
    </div>
  </div>
</template>
