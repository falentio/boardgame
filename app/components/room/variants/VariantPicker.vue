<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{ options: readonly { id: string; label: string }[] }>()
const model = defineModel<string>({ required: true })

const activeIndex = computed(() => props.options.findIndex((option) => option.id === model.value))

const step = (delta: number): void => {
  const count = props.options.length
  if (count === 0) return
  const next = (activeIndex.value + delta + count) % count
  model.value = props.options[next]!.id
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "ArrowRight") {
    event.preventDefault()
    step(1)
  } else if (event.key === "ArrowLeft") {
    event.preventDefault()
    step(-1)
  } else if (/^[1-9]$/.test(event.key)) {
    const index = Number(event.key) - 1
    const option = props.options[index]
    if (option) {
      event.preventDefault()
      model.value = option.id
    }
  }
}
</script>

<template>
  <nav class="variant-picker" aria-label="Seat display variants" @keydown="onKeydown">
    <button
      v-for="option in options"
      :key="option.id"
      type="button"
      :data-variant="option.id"
      :aria-current="option.id === model ? 'true' : undefined"
      @click="model = option.id"
    >
      {{ option.label }}
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
