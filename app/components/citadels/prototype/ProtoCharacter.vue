<script setup lang="ts">
import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts"
import { specOfCharacter } from "#shared/core/lockstep/games/citadels/index.ts"

const props = withDefaults(
  defineProps<{
    id: CharacterId
    state?: "pool" | "mine" | "faceup" | "killed" | "unknown"
    size?: "sm" | "md" | "lg"
    selected?: boolean
  }>(),
  { state: "pool", size: "md", selected: false },
)

const spec = () => specOfCharacter(props.id)

const INCOME_COLOR: Readonly<Record<string, string>> = {
  noble: "var(--mk-yellow)",
  religious: "var(--mk-blue)",
  trade: "var(--mk-green)",
  military: "var(--mk-pink)",
  unique: "var(--mk-purple)",
}

const SIZES = {
  sm: "p-2 gap-1",
  md: "p-2.5 gap-1.5",
  lg: "p-3.5 gap-2",
} as const

const stateClass = () => {
  if (props.state === "mine") return "border-[var(--mk-green)] bg-[var(--mk-green)]/10"
  if (props.state === "faceup") return "border-[var(--mk-line)] bg-[var(--mk-panel)]"
  if (props.state === "killed") return "border-[var(--mk-pink)]/40 bg-[var(--mk-panel)]/50"
  if (props.state === "unknown") return "border-dashed border-[var(--mk-line)] bg-transparent"
  return "border-[var(--mk-line)] bg-[var(--mk-panel)]/60"
}
</script>

<template>
  <article
    data-character
    :data-character="id"
    :data-state="state"
    class="relative flex min-w-0 flex-col rounded-md border transition-[border-color,background-color] duration-150 ease-out"
    :class="[SIZES[size], stateClass(), state === 'killed' && 'opacity-45', selected && 'border-[var(--mk-yellow)]']"
  >
    <div class="flex items-baseline justify-between gap-2">
      <span
        class="font-mono text-[0.6rem] leading-none tabular-nums text-[var(--mk-comment)]"
        >{{ String(spec().rank).padStart(2, "0") }}</span
      >
      <span class="truncate text-right text-[0.8em] leading-none font-semibold text-[var(--mk-fg)]">{{
        spec().name
      }}</span>
    </div>
    <p
      v-if="size !== 'sm' && state !== 'unknown'"
      class="line-clamp-3 text-[0.72em] leading-snug text-[var(--mk-comment)]"
    >
      {{ spec().summary }}
    </p>
    <p
      v-else-if="state === 'unknown'"
      class="text-[0.72em] leading-snug text-[var(--mk-comment)] italic"
    >
      face down
    </p>
    <span
      v-if="spec().income"
      class="mt-auto self-start rounded-sm px-1.5 py-0.5 text-[0.6em] leading-none font-medium"
      :style="{
        background: `color-mix(in srgb, ${INCOME_COLOR[spec().income?.counts ?? 'unique']} 18%, transparent)`,
        color: INCOME_COLOR[spec().income?.counts ?? 'unique'],
      }"
    >
      per {{ spec().income?.counts }}
    </span>
  </article>
</template>
