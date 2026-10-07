<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue"
import type { G54Action, G54State, G54View } from "#shared/core/lockstep/games/g54/index.ts"
import { g54 } from "#shared/core/lockstep/games/g54/index.ts"
import { STARTER_ROLES } from "#shared/core/lockstep/games/g54/roles.ts"
import {
  act,
  frameIndex,
  genesisSeed,
  makeRandom,
  makeRoster,
  type Frame,
} from "#shared/core/lockstep/index.ts"
import { seatId, type SeatId } from "#shared/rooms/ids.ts"
import { menuOf, type SeatIdentity, type WindowMenu } from "@/composables/window-menu.ts"
import { boardOf } from "@/composables/board-view.ts"
import GameBoard from "@/components/g54/board/GameBoard.vue"
import VariantPanel from "./action-window/VariantPanel.vue"
import VariantStage from "./action-window/VariantStage.vue"
import VariantDock from "./action-window/VariantDock.vue"

const ANN = seatId("ann")
const BOB = seatId("bob")
const CARA = seatId("cara")
const SEATS = [ANN, BOB, CARA]
const SEED = genesisSeed("action-window-harness")

const NAMES: Readonly<Record<string, string>> = { ann: "Ada", bob: "Bo", cara: "Cy" }
const identityOf = (seat: SeatId): SeatIdentity => ({ name: NAMES[seat] ?? seat, image: null })
const identities: ReadonlyMap<SeatId, SeatIdentity> = new Map(SEATS.map((seat) => [seat, identityOf(seat)]))

const genesis = (): G54State =>
  g54.genesis({ roles: [...STARTER_ROLES] }, makeRoster(SEATS), makeRandom(SEED))

const fold = (state: G54State, seat: SeatId, action: G54Action): G54State => {
  const frame: Frame<G54Action> = {
    index: frameIndex(0),
    seed: SEED,
    inputs: [[seat, act<G54Action>(action)]],
  }
  return g54.step(state, frame, makeRandom(SEED))
}

type WindowKind = "turn" | "challenge"

const windows = ["turn", "challenge"] as const

const route = useRoute()
const router = useRouter()

const readParam = (name: string): string | undefined => {
  const raw = route.query[name]
  return Array.isArray(raw) ? raw[0] : raw
}

const activeWindow = computed<WindowKind>(() => {
  const raw = readParam("window")
  return windows.includes(raw as WindowKind) ? (raw as WindowKind) : "turn"
})

const view = computed<{ view: G54View; seat: SeatId }>(() => {
  if (activeWindow.value === "challenge") {
    const claimed = fold(genesis(), ANN, { t: "claim", role: "banker", target: null })
    return { view: g54.project(claimed, BOB), seat: BOB }
  }
  return { view: g54.project(genesis(), ANN), seat: ANN }
})

const menu = computed<WindowMenu>(() => menuOf(view.value.view, view.value.seat, identityOf)!)
const board = computed(() => boardOf(view.value.view, identities))

const variants = ["panel", "stage", "dock"] as const
type Variant = (typeof variants)[number]
const LABELS: Readonly<Record<Variant, string>> = { panel: "Panel", stage: "Stage", dock: "Dock" }

const activeVariant = computed<Variant>(() => {
  const raw = readParam("variant")
  return variants.includes(raw as Variant) ? (raw as Variant) : "panel"
})

const select = (variant: Variant): void => {
  if (variant === activeVariant.value) return
  void router.replace({ query: { ...route.query, variant } })
}

const selectWindow = (window: WindowKind): void => {
  if (window === activeWindow.value) return
  void router.replace({ query: { ...route.query, window } })
}

const step = (delta: number): void => {
  const index = variants.indexOf(activeVariant.value)
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
  console.info("action window", action)
}
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-40 pt-20"
    :class="activeVariant === 'dock' && 'pb-64'"
  >
    <header class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-semibold text-balance">
          Action window container
        </h1>
        <p class="text-muted-foreground text-sm">
          One structural answer at a time, over the real board.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-muted-foreground text-sm">Window</span>
        <button
          v-for="window in windows"
          :key="window"
          type="button"
          class="rounded-full px-3 py-1 text-sm capitalize ring-1 ring-foreground/15"
          :class="window === activeWindow ? 'bg-foreground text-background' : 'bg-card'"
          :aria-pressed="window === activeWindow"
          @click="selectWindow(window)"
        >
          {{ window }}
        </button>
      </div>
    </header>

    <GameBoard :board="board" />

    <VariantPanel v-if="activeVariant === 'panel'" :menu="menu" @act="emitAct" />
    <VariantStage v-else-if="activeVariant === 'stage'" :menu="menu" @act="emitAct" />
  </div>

  <div v-if="activeVariant === 'dock'" class="fixed inset-x-0 bottom-0 z-10 p-4">
    <div class="mx-auto w-full max-w-5xl">
      <VariantDock :menu="menu" @act="emitAct" />
    </div>
  </div>

  <nav class="variant-picker" aria-label="Variants">
    <button
      v-for="variant in variants"
      :key="variant"
      type="button"
      :data-variant="variant"
      :aria-current="activeVariant === variant ? 'true' : undefined"
      @click="select(variant)"
    >
      {{ LABELS[variant] }}
    </button>
  </nav>
</template>

<style scoped>
.variant-picker {
  position: fixed;
  top: 24px;
  bottom: auto;
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
