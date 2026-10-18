<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import type { DistrictId } from "#shared/core/lockstep/games/citadels/index.ts";
import { specOfDistrict } from "#shared/core/lockstep/games/citadels/index.ts";
import { DISTRICT_ACCENT } from "@/composables/card-shell";
import { defaultAvatarUrl } from "#shared/users/avatar.ts";
import { cn } from "@/lib/utils";

const props = defineProps<{
  district: DistrictId;
  /** The Artist's beautify marker on a placed district. Absent for a card in hand. */
  gold?: number;
  class?: HTMLAttributes["class"];
}>();

const spec = computed(() => specOfDistrict(props.district));
const ink = computed(() => DISTRICT_ACCENT[spec.value.type]);
/** Stand-in art: the district has no illustration yet, so it gets its own dicebear. */
const art = computed(() => defaultAvatarUrl(spec.value.id));
const beautified = computed(() => (props.gold ?? 0) > 0);
const tier = computed(() => (spec.value.unique ? "unique" : "basic"));
const label = computed(
  () =>
    `${spec.value.name}, ${spec.value.type}, ${spec.value.cost} gold${beautified.value ? `, ${props.gold} gold on it` : ""}`,
);
</script>

<template>
  <article
    data-slot="citadels-district"
    :data-district="spec.id"
    :style="{ '--ink': ink }"
    :aria-label="label"
    :class="cn('citadels-district', props.class)"
  >
    <div class="citadels-district-art">
      <img :src="art" alt="" />
      <span class="citadels-district-plate">
        <span class="citadels-district-type">{{ spec.type }}</span>
        <span class="citadels-district-cost">{{ spec.cost }}</span>
      </span>
    </div>
    <div class="citadels-district-text">
      <span class="citadels-district-name">{{ spec.name }}</span>
      <span v-if="beautified" class="citadels-district-mark">+{{ gold }}</span>
      <span v-else class="citadels-district-tier">{{ tier }}</span>
    </div>
  </article>
</template>
<style scoped>
/* The panel face: an art window, a type plate inset over it, then the name. */
.citadels-district {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 143px;
  height: 201px;
  overflow: hidden;
  background: var(--monokai-panel);
  color: var(--monokai-fg);
  font-family: ui-monospace, monospace;
  box-shadow:
    inset 0 0 0 1px var(--monokai-line),
    inset 0 0 0 4px var(--monokai-bg),
    inset 0 0 0 6px var(--monokai-yellow);
}

.citadels-district-art {
  position: relative;
  height: 100px;
  margin: 8px 8px 0;
  overflow: hidden;
  background: var(--monokai-panel);
}

.citadels-district-art img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.citadels-district-plate {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  background: var(--ink);
}

.citadels-district-type,
.citadels-district-tier {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.citadels-district-type {
  color: var(--monokai-bg);
}

.citadels-district-cost {
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--monokai-bg);
}

.citadels-district-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  margin: 8px 8px 8px;
}

.citadels-district-name {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}

.citadels-district-tier {
  color: var(--monokai-comment);
}

.citadels-district-mark {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--monokai-yellow);
}
</style>