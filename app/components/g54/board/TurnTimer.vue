<script setup lang="ts">
import { computed } from "vue"
import { Timer, TriangleAlert } from "@lucide/vue"
import {
  announcementOf,
  clockLabel,
  fractionOf,
  secondsOf,
  toneOf,
  type TurnClock,
} from "@/composables/turn-timer.ts"

const props = defineProps<{ clock: TurnClock | null }>()

const seconds = computed(() => (props.clock === null ? 0 : secondsOf(props.clock.remainingMs)))
const tone = computed(() => toneOf(seconds.value))
const fraction = computed(() =>
  props.clock === null ? 0 : fractionOf(props.clock.remainingMs, props.clock.totalMs),
)
const label = computed(() => clockLabel(seconds.value))
const announcement = computed(() => (props.clock === null ? "" : announcementOf(seconds.value)))
const urgent = computed(() => tone.value === "urgent")

const toneText = computed(() => {
  if (tone.value === "urgent") return "text-destructive"
  if (tone.value === "warn") return "text-amber-700 dark:text-amber-300"
  return "text-foreground"
})

const toneFill = computed(() => {
  if (tone.value === "urgent") return "bg-destructive"
  if (tone.value === "warn") return "bg-amber-500"
  return "bg-primary"
})
</script>

<template>
  <div
    v-if="clock !== null"
    class="flex items-center gap-3 rounded-xl border border-foreground/10 bg-muted/40 px-4 py-3"
    data-slot="turn-timer"
  >
    <component
      :is="urgent ? TriangleAlert : Timer"
      class="size-4 shrink-0"
      :class="toneText"
      aria-hidden="true"
    />
    <p class="min-w-0 flex-1 text-sm leading-snug">
      You have
      <span
        role="timer"
        class="font-semibold tabular-nums"
        :class="toneText"
        :aria-label="label"
      >{{ seconds }}s</span>
      to act.
    </p>
    <span
      class="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-foreground/10"
      aria-hidden="true"
    >
      <span
        class="block h-full rounded-full transition-[width] duration-200 ease-linear"
        :class="toneFill"
        :style="{ width: `${fraction * 100}%` }"
      />
    </span>
  </div>
  <!-- Stable live region: present before its text changes, so the threshold is announced once. -->
  <p class="sr-only" role="status">{{ announcement }}</p>
</template>

<style scoped>
/* The bar eases between the 250ms ticks. Under reduced motion the number still
   counts down; only the easing between steps goes away. */
@media (prefers-reduced-motion: reduce) {
  [data-slot="turn-timer"] * {
    transition-duration: 0ms !important;
  }
}
</style>
