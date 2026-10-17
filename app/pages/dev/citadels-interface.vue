<script setup lang="ts">
/** Throwaway harness. Four board layouts behind the prototype picker; nothing here ships. */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import VariantInspector from "@/components/citadels/prototype/VariantInspector.vue"
import VariantProjector from "@/components/citadels/prototype/VariantProjector.vue"
import VariantTable from "@/components/citadels/prototype/VariantTable.vue"
import VariantWall from "@/components/citadels/prototype/VariantWall.vue"
import "@/components/citadels/prototype/proto-theme.css"

definePageMeta({ layout: false })

const VARIANTS = [
  { name: "Inspector", component: VariantInspector },
  { name: "Table", component: VariantTable },
  { name: "Wall", component: VariantWall },
  { name: "Projector", component: VariantProjector },
] as const

const current = ref(0)
const stageKey = ref(0)
const active = shallowRef(VARIANTS[0].component)

const picker = ref<HTMLElement | null>(null)
const highlight = ref<HTMLElement | null>(null)
const itemEls = ref<HTMLElement[]>([])
const ready = ref(false)

const items = computed(() => VARIANTS.map((variant) => variant.name))

const setItemRef = (el: Element | null, index: number) => {
  if (el instanceof HTMLElement) itemEls.value[index] = el
}

const moveHighlight = () => {
  const el = itemEls.value[current.value]
  const bar = highlight.value
  if (el === undefined || bar === null) return
  bar.style.width = `${el.offsetWidth}px`
  bar.style.transform = `translateX(${el.offsetLeft}px)`
}

const mount = () => {
  stageKey.value += 1
}

const select = (index: number) => {
  if (index < 0 || index >= VARIANTS.length) return
  current.value = index
  active.value = VARIANTS[index].component
  const url = new URL(location.href)
  url.searchParams.set("v", String(index + 1))
  history.replaceState(null, "", url)
  void nextTick(() => {
    moveHighlight()
    mount()
  })
}

const onKey = (event: KeyboardEvent) => {
  const target = event.target
  if (target instanceof HTMLElement) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return
  const num = Number.parseInt(event.key, 10)
  if (num >= 1 && num <= VARIANTS.length) select(num - 1)
  else if (event.key === "ArrowRight") select((current.value + 1) % VARIANTS.length)
  else if (event.key === "ArrowLeft") select((current.value - 1 + VARIANTS.length) % VARIANTS.length)
  else if (event.key === "r" || event.key === "R") mount()
}

const onResize = () => moveHighlight()

onMounted(() => {
  const fromUrl = Number.parseInt(new URLSearchParams(location.search).get("v") ?? "1", 10)
  current.value = fromUrl >= 1 && fromUrl <= VARIANTS.length ? fromUrl - 1 : 0
  active.value = VARIANTS[current.value].component
  window.addEventListener("keydown", onKey)
  window.addEventListener("resize", onResize)
  void nextTick(() => {
    moveHighlight()
    requestAnimationFrame(() => {
      moveHighlight()
      ready.value = true
    })
  })
})

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey)
  window.removeEventListener("resize", onResize)
})

watch(current, () => void nextTick(moveHighlight))
</script>

<template>
  <div class="proto-root h-dvh w-full overflow-hidden">
    <component :is="active" :key="stageKey" />

    <nav ref="picker" class="proto-picker" :data-ready="ready ? '' : undefined" aria-label="Prototype variants">
      <span ref="highlight" class="proto-picker-highlight" aria-hidden="true" />
      <button
        v-for="(name, index) in items"
        :key="name"
        :ref="(el) => setItemRef(el as Element | null, index)"
        type="button"
        class="proto-picker-item"
        :data-active="index === current ? '' : undefined"
        :aria-current="index === current ? 'true' : undefined"
        @click="select(index)"
      >
        {{ name }}
      </button>
      <span class="proto-picker-divider" aria-hidden="true" />
      <button
        type="button"
        class="proto-picker-item proto-picker-replay"
        aria-label="Replay animation (R)"
        @click="mount"
      >
        ↻
      </button>
    </nav>
  </div>
</template>

<style>
.proto-picker {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(10, 10, 10, 0.82);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  backdrop-filter: blur(12px) saturate(1.4);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 8px 24px rgba(0, 0, 0, 0.24),
    0 2px 6px rgba(0, 0, 0, 0.12);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}

.proto-picker-highlight {
  position: absolute;
  top: 4px;
  left: 0;
  height: 28px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  will-change: transform;
}

.proto-picker[data-ready] .proto-picker-highlight {
  transition:
    transform 250ms cubic-bezier(0.23, 1, 0.32, 1),
    width 250ms cubic-bezier(0.23, 1, 0.32, 1);
}

@media (prefers-reduced-motion: reduce) {
  .proto-picker[data-ready] .proto-picker-highlight { transition: none; }
}

.proto-picker-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font: inherit;
  cursor: pointer;
  transition: color 150ms ease-out;
}

.proto-picker-item:hover {
  color: rgba(255, 255, 255, 0.85);
}

.proto-picker-item:active {
  transform: scale(0.97);
}

.proto-picker-item:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.4);
  outline-offset: 2px;
}

.proto-picker-item[data-active] {
  color: #fff;
}

.proto-picker-divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.12);
}

.proto-picker-replay {
  padding: 0 10px;
  font-size: 14px;
}
</style>
