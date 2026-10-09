<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type { CardChoice, TargetCard, WindowMenu } from "@/composables/window-menu.ts"
import { generalCardModel, verbCardModel } from "@/composables/general-card.ts"
import { seatId, type SeatId } from "#shared/rooms/ids.ts"
import Confirm from "@/components/g54/board/picker/Confirm.vue"
import Direct from "@/components/g54/board/picker/Direct.vue"
import Roster from "@/components/g54/board/picker/Roster.vue"
import Tray from "@/components/g54/board/picker/Tray.vue"
import Sheet from "@/components/g54/board/picker/Sheet.vue"

definePageMeta({ layout: false })

type Variant = "confirm" | "direct" | "roster" | "tray" | "sheet"
type Scene = "challenge" | "turn"

const VARIANTS: readonly Variant[] = ["confirm", "direct", "roster", "tray", "sheet"]
const SCENES: readonly Scene[] = ["challenge", "turn"]
const VARIANT_COMPONENTS = { confirm: Confirm, direct: Direct, roster: Roster, tray: Tray, sheet: Sheet }

const route = useRoute()
const router = useRouter()

const variant = computed<Variant>(() => {
  const raw = String(route.query.variant ?? "confirm")
  return (VARIANTS as readonly string[]).includes(raw) ? (raw as Variant) : "confirm"
})
const scene = computed<Scene>(() => {
  const raw = String(route.query.scene ?? "challenge")
  return (SCENES as readonly string[]).includes(raw) ? (raw as Scene) : "challenge"
})

const activeComponent = computed(() => VARIANT_COMPONENTS[variant.value])

const setVariant = (next: Variant) => router.replace({ query: { ...route.query, variant: next } })
const setScene = (next: Scene) => router.replace({ query: { ...route.query, scene: next } })

const onKey = (event: KeyboardEvent) => {
  if (event.target instanceof HTMLInputElement) return
  const index = VARIANTS.indexOf(variant.value)
  if (event.key === "ArrowRight") setVariant(VARIANTS[(index + 1) % VARIANTS.length] ?? "confirm")
  if (event.key === "ArrowLeft") setVariant(VARIANTS[(index - 1 + VARIANTS.length) % VARIANTS.length] ?? "confirm")
  const jump = Number(event.key)
  if (jump >= 1 && jump <= VARIANTS.length) setVariant(VARIANTS[jump - 1] ?? "confirm")
}
onMounted(() => window.addEventListener("keydown", onKey))
onUnmounted(() => window.removeEventListener("keydown", onKey))

const BOB = seatId("bob")
const CAROL = seatId("carol")
const DAVE = seatId("dave")

const playerTarget = (seat: SeatId, name: string, enabled = true, reason: string | null = null): TargetCard => ({
  id: `seat-${seat}`,
  face: { kind: "player", seat, name, image: null },
  enabled,
  reason,
  group: null,
  index: null,
})

const targets: readonly TargetCard[] = [
  playerTarget(BOB, "Bob"),
  playerTarget(CAROL, "Carol"),
  playerTarget(DAVE, "Dave", false, "Shielded by the Peacekeeper"),
]

const direct = (
  id: string,
  label: string,
  summary: string,
  resolve: () => G54Action,
  enabled = true,
  reason: string | null = null,
): CardChoice => ({
  id,
  face: { kind: "action", card: verbCardModel(label, summary) },
  enabled,
  reason,
  group: null,
  target: null,
  resolve,
})

const challengeMenu: WindowMenu = {
  title: "Challenge the claim",
  note: "Bob claims Guerrilla on Dave.",
  cards: [
    direct("challenge", "Challenge", "Call the claim a bluff.", () => ({ t: "challenge" })),
    direct("pass", "Pass", "Let the claim stand.", () => ({ t: "pass" })),
  ],
}

const turnMenu: WindowMenu = {
  title: "Your turn",
  note: "2 coins. Income is always safe.",
  cards: [
    {
      id: "income",
      face: { kind: "action", card: generalCardModel("income") },
      enabled: true,
      reason: null,
      group: null,
      target: null,
      resolve: () => ({ t: "income" }),
    },
    {
      id: "bank",
      face: { kind: "action", card: generalCardModel("bank") },
      enabled: true,
      reason: null,
      group: null,
      target: null,
      resolve: () => ({ t: "bank" }),
    },
    {
      id: "claim-politician",
      face: { kind: "role", role: "politician" },
      enabled: true,
      reason: null,
      group: "Claim a role",
      target: [{ id: "target", count: 1, cards: targets }],
      resolve: (picks) => ({
        t: "claim",
        role: "politician",
        target: picks[0]?.face.kind === "player" ? picks[0].face.seat : null,
      }),
    },
    {
      id: "claim-guerrilla",
      face: { kind: "role", role: "guerrilla" },
      enabled: false,
      reason: "Needs 3 coins",
      group: "Claim a role",
      target: [{ id: "target", count: 1, cards: targets }],
      resolve: (picks) => ({
        t: "claim",
        role: "guerrilla",
        target: picks[0]?.face.kind === "player" ? picks[0].face.seat : null,
      }),
    },
  ],
}

const menu = computed<WindowMenu>(() => (scene.value === "challenge" ? challengeMenu : turnMenu))

const last = ref<string>("")
watch([variant, scene], () => { last.value = "" })

const onAct = (action: G54Action) => { last.value = JSON.stringify(action) }

const SEATS = [
  { name: "Alice", coins: 2, active: true, me: true },
  { name: "Bob", coins: 7, active: false, me: false },
  { name: "Carol", coins: 3, active: false, me: false },
  { name: "Dave", coins: 10, active: false, me: false },
]
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-background text-foreground">
    <header class="flex items-center gap-3 border-b border-border px-4 py-3">
      <span class="text-sm font-semibold">Friday Coup</span>
      <span class="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs tabular-nums">Turn 4</span>
      <span class="text-muted-foreground text-sm">Your turn</span>
      <span class="text-muted-foreground ms-auto text-sm tabular-nums">Treasury 33</span>
    </header>

    <main class="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 pt-6">
      <div class="flex flex-col gap-2">
        <div
          v-for="seat in SEATS"
          :key="seat.name"
          class="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
          :class="seat.active && 'ring-2 ring-primary'"
        >
          <span class="bg-muted grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold">
            {{ seat.name.slice(0, 1) }}
          </span>
          <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ seat.me ? "You" : seat.name }}</span>
          <span class="text-muted-foreground text-xs tabular-nums">{{ seat.coins }} coins</span>
          <span v-if="seat.active" class="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs">Turn</span>
        </div>
      </div>

      <component :is="activeComponent" :menu="menu" :busy="false" @act="onAct" />

      <p class="text-muted-foreground min-h-5 text-sm" role="status" aria-live="polite">
        <span v-if="last">Fired <code class="font-mono text-xs">{{ last }}</code></span>
        <span v-else>No action fired yet.</span>
      </p>
    </main>

    <nav class="variant-picker" aria-label="Variants">
      <button
        v-for="name in VARIANTS"
        :key="name"
        type="button"
        :data-variant="name"
        :aria-current="variant === name ? 'true' : 'false'"
        @click="setVariant(name)"
      >
        {{ name[0]?.toUpperCase() + name.slice(1) }}
      </button>
    </nav>

    <nav class="scene-picker" aria-label="Scene">
      <button
        v-for="name in SCENES"
        :key="name"
        type="button"
        :data-scene="name"
        :aria-current="scene === name ? 'true' : 'false'"
        @click="setScene(name)"
      >
        {{ name[0]?.toUpperCase() + name.slice(1) }}
      </button>
    </nav>
  </div>
</template>

<style>
.variant-picker,
.scene-picker {
  position: fixed;
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
.variant-picker {
  top: 12px;
}
.scene-picker {
  top: 56px;
  font-size: 12px;
}
.variant-picker button,
.scene-picker button {
  padding: 7px 14px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: rgb(255 255 255 / 0.6);
  cursor: pointer;
}
.variant-picker button:hover,
.scene-picker button:hover {
  color: rgb(255 255 255 / 0.85);
}
.variant-picker button[aria-current="true"],
.scene-picker button[aria-current="true"] {
  background: rgb(255 255 255 / 0.14);
  color: rgb(255 255 255);
}
.variant-picker button:focus-visible,
.scene-picker button:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.7);
  outline-offset: 2px;
}
</style>
