<script setup lang="ts">
import { computed, type Component } from "vue";
import { CircleCheck, Drama, Landmark, Palette, Square, Users } from "@lucide/vue";
import type { CitadelsAction } from "#shared/core/lockstep/games/citadels/index.ts";
import type { CitadelsBoard } from "@/composables/citadels-board.ts";
import { windowChoiceValue, type WindowChoiceKind } from "@/composables/window-choices.ts";

const props = defineProps<{ board: CitadelsBoard }>();
const emit = defineEmits<{ choose: [action: CitadelsAction] }>();

const window = computed(() => props.board.table.window);
const choices = computed(() => window.value?.choices ?? []);
const open = computed(() => window.value?.owedByMe === true && choices.value.length > 0);

const ICONS: Record<WindowChoiceKind, Component> = {
  seat: Users,
  character: Drama,
  type: Palette,
  district: Landmark,
  card: Square,
  confirm: CircleCheck,
};
</script>

<template>
  <section
    v-if="open"
    data-slot="citadels-choice"
    :data-choice-purpose="window?.purpose"
    :data-choice-count="choices.length"
    class="citadels-piece citadels-piece--plate flex flex-col gap-1 p-1"
  >
    <h3 class="citadels-label">{{ window?.label }}</h3>
    <ul class="flex flex-wrap gap-1">
      <li v-for="(choice, at) in choices" :key="`${choice.kind}-${at}-${windowChoiceValue(choice)}`">
        <button
          type="button"
          data-slot="citadels-choice-option"
          :data-choice-kind="choice.kind"
          :data-choice-value="windowChoiceValue(choice)"
          class="citadels-piece flex min-w-0 items-center gap-1.5 px-2 py-1.5 text-left font-mono text-[0.625rem] leading-none font-bold tracking-[0.14em] text-monokai-fg uppercase focus-visible:outline-none"
          @click="emit('choose', choice.action)"
        >
          <component
            :is="ICONS[choice.kind]"
            class="size-3.5 shrink-0 text-monokai-comment"
            aria-hidden="true"
          />
          <span class="min-w-0 [overflow-wrap:anywhere]">{{ choice.label }}</span>
          <span
            v-if="choice.note !== null"
            class="citadels-plate shrink-0 px-1 py-0.5 text-[0.5rem] leading-none font-bold"
            >{{ choice.note }}</span
          >
        </button>
      </li>
    </ul>
  </section>
</template>
