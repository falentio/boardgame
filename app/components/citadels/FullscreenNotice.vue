<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { computed } from "vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  notice: string | null;
  canRetry: boolean;
  class?: HTMLAttributes["class"];
}>();

const emit = defineEmits<{ retry: [] }>();

const line = computed(() => props.notice ?? "Fullscreen is not active");
</script>

<template>
  <p
    v-if="canRetry || notice !== null"
    data-slot="citadels-notice"
    role="status"
    :class="cn('flex flex-wrap items-center gap-2 leading-normal text-muted-foreground', props.class)"
  >
    {{ line }}
    <button
      v-if="canRetry"
      data-slot="citadels-retry"
      type="button"
      class="text-primary underline-offset-4 hover:underline"
      @click="emit('retry')"
    >
      Try fullscreen again
    </button>
  </p>
</template>
