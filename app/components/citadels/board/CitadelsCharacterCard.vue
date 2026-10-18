<script setup lang="ts">
import { computed } from "vue";
import { specOfCharacter } from "#shared/core/lockstep/games/citadels/index.ts";
import type { CastSlot } from "@/composables/citadels-board.ts";
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts";
import { defaultAvatarUrl } from "#shared/users/avatar.ts";
import "./citadels-skin.css";

const props = defineProps<{ slot: CastSlot; picked?: boolean }>();
const emit = defineEmits<{ choose: [] }>();

const spec = computed(() => specOfCharacter(props.slot.character));
const emblem = computed(() => defaultAvatarUrl(props.slot.character));
const taken = computed(
  () => props.slot.state === "mine" || props.slot.state === "pending" || props.slot.state === "faceup",
);
const stateLabel = computed(
  () =>
    props.slot.state === "mine"
      ? "yours"
      : props.slot.state === "pending"
        ? "claimed"
        : props.slot.state === "faceup"
          ? "shown"
          : "available",
);
</script>
<template>
  <button
    type="button"
    data-slot="citadels-picker-card"
    :data-character="slot.character"
    :data-state="slot.state"
    :disabled="taken"
    :aria-pressed="picked === true ? 'true' : undefined"
    :aria-label="`${spec.name}, rank ${spec.rank}, ${stateLabel}`"
    class="citadels-character citadels-piece citadels-piece--thick group/card relative flex w-full flex-col text-left disabled:cursor-not-allowed"
    :class="taken && 'opacity-40'"
    @click="emit('choose')"
  >
    <span class="citadels-character-art">
      <img :src="emblem" alt="" />
      <span class="citadels-character-plate">
        <span class="citadels-character-rank">{{ String(spec.rank).padStart(2, "0") }}</span>
        <span class="citadels-character-state">{{ stateLabel }}</span>
      </span>
    </span>
    <span class="citadels-character-text">
      <span class="citadels-character-name">{{ spec.name }}</span>
    </span>
  </button>
</template>

<style scoped>
/*
 * The district card, for a character: art window, a plate over it, then the name.
 * Square corners, Monokai, and the same 143/201 proportion so a hand of either
 * card reads as one deck.
 */
.citadels-character {
  aspect-ratio: 143 / 201;
  overflow: hidden;
  color: var(--monokai-fg);
}

.citadels-character:disabled:hover {
  box-shadow:
    inset 0 0 0 1px var(--monokai-line),
    inset 0 0 0 4px var(--monokai-bg),
    inset 0 0 0 6px var(--monokai-yellow);
  translate: none;
}

.citadels-character-art {
  position: relative;
  display: block;
  aspect-ratio: 1;
  margin: 8px 8px 0;
  overflow: hidden;
  background: var(--monokai-bg);
}

.citadels-character-art img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.citadels-character-plate {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 6px;
  background: var(--monokai-yellow);
}

.citadels-character-rank {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--monokai-bg);
}

.citadels-character-state {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--monokai-bg);
}

.citadels-character-text {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
  gap: 3px;
  margin: 8px;
}

.citadels-character-name {
  font-size: 13px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}
</style>