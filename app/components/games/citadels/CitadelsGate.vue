<script setup lang="ts">
import { Maximize } from "@lucide/vue";
import FullscreenNotice from "@/components/citadels/FullscreenNotice.vue";
import { buttonVariants } from "@/components/ui/button";
import type { CitadelsBoard } from "@/composables/citadels-board.ts";

defineProps<{
  board: CitadelsBoard;
  canEnter: boolean;
  notice: string | null;
  canRetry: boolean;
}>();
const emit = defineEmits<{ open: []; retry: [] }>();
</script>

<template>
  <div data-slot="citadels-gate" class="flex flex-col items-start gap-3">
    <h1 class="text-2xl leading-tight font-semibold">Citadels</h1>
    <p data-slot="citadels-phase" class="text-muted-foreground text-sm leading-normal tabular-nums">
      Round {{ board.round }} · {{ board.phaseLabel }} · {{ board.cast.length }} characters
    </p>

    <button
      data-slot="citadels-enter"
      type="button"
      :class="buttonVariants({ size: 'lg' })"
      @click="emit('open')"
    >
      <Maximize class="size-4" aria-hidden="true" />
      {{ canEnter ? "Open in fullscreen" : "Open the game" }}
    </button>

    <p v-if="!canEnter" class="text-muted-foreground text-sm leading-normal">
      This browser cannot open fullscreen, so the game fills the window instead.
    </p>

    <FullscreenNotice
      :notice="notice"
      :can-retry="canRetry"
      class="text-sm"
      @retry="emit('retry')"
    />
  </div>
</template>
