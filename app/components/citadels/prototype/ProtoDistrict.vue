<script setup lang="ts">
import { specOfDistrict } from "#shared/core/lockstep/games/citadels/index.ts"
import type { DistrictType } from "#shared/core/lockstep/games/citadels/districts.ts"

const props = withDefaults(
  defineProps<{
    id: string
    gold?: number
    size?: "xxs" | "xs" | "sm" | "md" | "lg"
    selected?: boolean
    dimmed?: boolean
    affordable?: boolean
    compact?: boolean
  }>(),
  { gold: 0, size: "sm", selected: false, dimmed: false, affordable: true, compact: false },
)

const TYPE_COLOR: Readonly<Record<DistrictType, string>> = {
  noble: "var(--mk-yellow)",
  religious: "var(--mk-blue)",
  trade: "var(--mk-green)",
  military: "var(--mk-pink)",
  unique: "var(--mk-purple)",
}

const spec = () => specOfDistrict(props.id)

const SIZES = {
  xxs: "h-5 px-1.5 text-[0.5rem]",
  xs: "h-7 px-1.5 text-[0.5625rem]",
  sm: "h-8 px-2 text-[0.625rem]",
  md: "h-11 px-2.5 text-[0.6875rem]",
  lg: "h-14 px-3 text-xs",
} as const

const padClass = () => (props.size === "xxs" ? "pl-1" : "pl-3")
</script>

<template>
  <span
    data-district
    :data-district="id"
    :data-type="spec().type"
    :data-selected="selected"
    class="relative flex w-40 shrink-0 flex-col justify-center gap-0.5 overflow-hidden rounded-md border bg-[var(--mk-panel)] transition-[border-color,background-color,opacity] duration-150 ease-out"
    :class="[
      SIZES[size],
      selected
        ? 'border-[var(--mk-yellow)] bg-[var(--mk-yellow)]/10'
        : 'border-[var(--mk-line)]',
      dimmed && 'opacity-40',
      compact && 'w-28',
    ]"
    :title="`${spec().name} · ${spec().type} · ${spec().cost} gold`"
  >
    <span
      class="absolute inset-y-0 left-0 w-[3px]"
      :style="{ background: TYPE_COLOR[spec().type] }"
      aria-hidden="true"
    />
    <span class="flex items-center gap-1.5 pl-1.5">
      <span
        class="size-1.5 shrink-0 rounded-full"
        :style="{ background: TYPE_COLOR[spec().type] }"
        aria-hidden="true"
      />
      <span class="truncate leading-none font-medium text-[var(--mk-fg)]">{{ spec().name }}</span>
    </span>
    <span class="flex items-center gap-1.5 leading-none tabular-nums" :class="padClass()">
      <span
        :class="affordable ? 'text-[var(--mk-yellow)]' : 'text-[var(--mk-comment)]'"
        >{{ spec().cost }}g</span
      >
      <span v-if="gold > 0" class="text-[var(--mk-orange)]">+{{ gold }}</span>
    </span>
  </span>
</template>
