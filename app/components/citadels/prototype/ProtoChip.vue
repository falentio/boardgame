<script setup lang="ts">
withDefaults(defineProps<{ tone?: "line" | "gold" | "green" | "pink" | "blue" | "purple" }>(), {
  tone: "line",
})

const TONE: Readonly<Record<string, string>> = {
  line: "border-[var(--mk-line)] text-[var(--mk-comment)]",
  gold: "border-[var(--mk-yellow)]/50 text-[var(--mk-yellow)]",
  green: "border-[var(--mk-green)]/50 text-[var(--mk-green)]",
  pink: "border-[var(--mk-pink)]/50 text-[var(--mk-pink)]",
  blue: "border-[var(--mk-blue)]/50 text-[var(--mk-blue)]",
  purple: "border-[var(--mk-purple)]/50 text-[var(--mk-purple)]",
}
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 font-mono text-[0.6rem] leading-none tracking-wide uppercase"
    :class="TONE[tone]"
  >
    <slot />
  </span>
</template>
