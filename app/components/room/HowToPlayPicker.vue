<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue"
import {
  HOW_TO_PLAY_VARIANTS,
  HOW_TO_PLAY_VARIANT_IDS,
} from "@/composables/how-to-play"
import { useHowToPlayVariant } from "@/composables/use-how-to-play-variant"

const { variant, setVariant } = useHowToPlayVariant()

const pickerEdge = computed(() =>
  HOW_TO_PLAY_VARIANTS[variant.value].edge === "bottom" ? "top" : "bottom",
)

const step = (delta: number) => {
  const index = HOW_TO_PLAY_VARIANT_IDS.indexOf(variant.value)
  const count = HOW_TO_PLAY_VARIANT_IDS.length
  setVariant(HOW_TO_PLAY_VARIANT_IDS[(index + delta + count) % count]!)
}

const onKey = (event: KeyboardEvent) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target
  if (target instanceof HTMLElement && target.isContentEditable) return
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
  if (event.key === "ArrowRight") step(1)
  else if (event.key === "ArrowLeft") step(-1)
  else {
    const jump = Number(event.key)
    if (jump >= 1 && jump <= HOW_TO_PLAY_VARIANT_IDS.length) {
      setVariant(HOW_TO_PLAY_VARIANT_IDS[jump - 1]!)
    }
  }
}

onMounted(() => window.addEventListener("keydown", onKey))
onUnmounted(() => window.removeEventListener("keydown", onKey))
</script>

<template>
  <nav class="variant-picker" :data-edge="pickerEdge" aria-label="Variants">
    <button
      v-for="id in HOW_TO_PLAY_VARIANT_IDS"
      :key="id"
      type="button"
      :data-variant="id"
      :title="HOW_TO_PLAY_VARIANTS[id].note"
      :aria-current="variant === id ? 'true' : 'false'"
      @click="setVariant(id)"
    >
      {{ HOW_TO_PLAY_VARIANTS[id].label }}
    </button>
  </nav>
</template>

<style>
.variant-picker {
  position: fixed;
  bottom: 24px;
  left: 50%;
  translate: -50% 0;
  z-index: 2147483647;
  display: flex;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: rgb(20 20 20 / 0.9);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 8px 24px rgb(0 0 0 / 0.25);
  font: 13px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  user-select: none;
}

.variant-picker[data-edge="top"] {
  top: 80px;
  bottom: auto;
}

.variant-picker button {
  padding: 7px 14px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: rgb(255 255 255 / 0.6);
  cursor: pointer;
}

.variant-picker button:hover {
  color: rgb(255 255 255 / 0.85);
}

.variant-picker button[aria-current="true"] {
  background: rgb(255 255 255 / 0.14);
  color: rgb(255 255 255);
}

.variant-picker button:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.7);
  outline-offset: 2px;
}
</style>
