<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import { g54 } from "#shared/core/lockstep/games/g54/index.ts"
import { STARTER_ROLES } from "#shared/core/lockstep/games/g54/roles.ts"
import { genesisSeed, makeRandom, makeRoster } from "#shared/core/lockstep/index.ts"
import { seatId } from "#shared/rooms/ids.ts"
import { menuOf, type WindowMenu } from "@/composables/window-menu.ts"
import VariantGrid from "./turn-ui/VariantGrid.vue"
import VariantSections from "./turn-ui/VariantSections.vue"
import VariantHand from "./turn-ui/VariantHand.vue"

const SEATS = [seatId("ann"), seatId("bob"), seatId("cara")]
const NAMES: Readonly<Record<string, string>> = { ann: "Ada", bob: "Bo", cara: "Cy" }
const nameOf = (seat: string): string => NAMES[seat] ?? seat

const menu = computed<WindowMenu>(() => {
  const state = g54.genesis(
    { roles: [...STARTER_ROLES] },
    makeRoster(SEATS),
    makeRandom(genesisSeed("turn-ui-harness")),
  )
  const view = g54.project(state, SEATS[0]!)
  return menuOf(view, SEATS[0]!, nameOf)!
})

const variants = ["grid", "sections", "hand"] as const
type Variant = (typeof variants)[number]
const LABELS: Readonly<Record<Variant, string>> = {
  grid: "Grid",
  sections: "Sections",
  hand: "Hand",
}

const route = useRoute()
const router = useRouter()

const active = computed<Variant>(() => {
  const raw = Array.isArray(route.query.variant) ? route.query.variant[0] : route.query.variant
  return variants.includes(raw as Variant) ? (raw as Variant) : "grid"
})

const select = (variant: Variant): void => {
  if (variant === active.value) return
  void router.replace({ query: { ...route.query, variant } })
}

const step = (delta: number): void => {
  const index = variants.indexOf(active.value)
  const next = variants[(index + delta + variants.length) % variants.length]!
  select(next)
}

const onKeydown = (event: KeyboardEvent): void => {
  if (event.key === "ArrowLeft") {
    step(-1)
    return
  }
  if (event.key === "ArrowRight") {
    step(1)
    return
  }
  const index = Number(event.key)
  if (Number.isInteger(index) && index >= 1 && index <= variants.length) {
    select(variants[index - 1]!)
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown))
onUnmounted(() => window.removeEventListener("keydown", onKeydown))

const emitAct = (action: G54Action): void => {
  console.info("turn action", action)
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
    <div class="rounded-xl border border-foreground/10 bg-card p-4">
      <VariantGrid v-if="active === 'grid'" :menu="menu" @act="emitAct" />
      <VariantSections v-else-if="active === 'sections'" :menu="menu" @act="emitAct" />
      <VariantHand v-else :menu="menu" @act="emitAct" />
    </div>
  </div>

  <nav class="variant-picker" aria-label="Variants">
    <button
      v-for="variant in variants"
      :key="variant"
      type="button"
      :data-variant="variant"
      :aria-current="active === variant ? 'true' : undefined"
      @click="select(variant)"
    >
      {{ LABELS[variant] }}
    </button>
  </nav>
</template>

<style scoped>
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
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.1),
    0 8px 24px rgb(0 0 0 / 0.25);
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
