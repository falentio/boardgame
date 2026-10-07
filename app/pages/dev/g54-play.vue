<script setup lang="ts">
import type { RoleId } from "#shared/core/lockstep/games/g54/roles.ts"
import { computed, onMounted, onUnmounted } from "vue"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import RoleCard from "@/components/g54/RoleCard.vue"
import { roleCardModel } from "@/composables/role-card"
import { initialsOf } from "#shared/users/initials.ts"

definePageMeta({ layout: false })

type Variant = "ring" | "focus" | "spread"
type Scene = "challenge" | "turn" | "terminal"

const VARIANTS: readonly Variant[] = ["ring", "focus", "spread"]
const SCENES: readonly Scene[] = ["challenge", "turn", "terminal"]

const route = useRoute()
const router = useRouter()

const variant = computed<Variant>(() => {
  const raw = String(route.query.variant ?? "ring")
  return (VARIANTS as readonly string[]).includes(raw) ? (raw as Variant) : "ring"
})
const scene = computed<Scene>(() => {
  const raw = String(route.query.scene ?? "challenge")
  return (SCENES as readonly string[]).includes(raw) ? (raw as Scene) : "challenge"
})

const setVariant = (next: Variant) => router.replace({ query: { ...route.query, variant: next } })
const setScene = (next: Scene) => router.replace({ query: { ...route.query, scene: next } })

const onKey = (event: KeyboardEvent) => {
  if (event.target instanceof HTMLInputElement) return
  const index = VARIANTS.indexOf(variant.value)
  if (event.key === "ArrowRight") setVariant(VARIANTS[(index + 1) % VARIANTS.length] ?? "ring")
  if (event.key === "ArrowLeft") setVariant(VARIANTS[(index - 1 + VARIANTS.length) % VARIANTS.length] ?? "ring")
  const jump = Number(event.key)
  if (jump >= 1 && jump <= VARIANTS.length) setVariant(VARIANTS[jump - 1] ?? "ring")
}
onMounted(() => window.addEventListener("keydown", onKey))
onUnmounted(() => window.removeEventListener("keydown", onKey))

interface SeatModel {
  readonly seat: string
  readonly name: string
  readonly isMe: boolean
  readonly isActive: boolean
  readonly eliminated: boolean
  readonly coins: number
  readonly hand: readonly RoleId[]
  readonly handCount: number
  readonly revealed: readonly RoleId[]
}

const ROLES: readonly RoleId[] = ["banker", "director", "guerrilla", "politician", "peacekeeper"]
const GENERAL: readonly string[] = ["Income", "Coup"]

const BASE: readonly Omit<SeatModel, "isActive">[] = [
  { seat: "s1", name: "Alice", isMe: true, eliminated: false, coins: 2, hand: ["guerrilla", "banker"], handCount: 2, revealed: [] },
  { seat: "s2", name: "Bob", isMe: false, eliminated: false, coins: 7, hand: [], handCount: 2, revealed: [] },
  { seat: "s3", name: "Carol", isMe: false, eliminated: false, coins: 3, hand: [], handCount: 2, revealed: [] },
  { seat: "s4", name: "Dave", isMe: false, eliminated: false, coins: 10, hand: [], handCount: 2, revealed: [] },
  { seat: "s5", name: "Erin", isMe: false, eliminated: true, coins: 0, hand: [], handCount: 0, revealed: ["peacekeeper", "politician"] },
]

const seats = computed<readonly SeatModel[]>(() =>
  BASE.map((seat) => ({
    ...seat,
    isActive: scene.value === "turn" ? seat.isMe : seat.seat === "s2",
  })),
)

const me = computed(() => seats.value.find((seat) => seat.isMe))
const rivals = computed(() => seats.value.filter((seat) => !seat.isMe && !seat.eliminated))
const out = computed(() => seats.value.filter((seat) => seat.eliminated))
const activeSeat = computed(() => seats.value.find((seat) => seat.isActive))

const courtCount = 9
const treasury = 33
const bank = 0
const turn = 4

interface PromptOption {
  readonly label: string
  readonly tone: "primary" | "ghost" | "danger"
}

interface Prompt {
  readonly kicker: string
  readonly headline: string
  readonly detail: string
  readonly options: readonly PromptOption[]
}

const PROMPTS: Record<Scene, Prompt> = {
  challenge: {
    kicker: "Challenge window",
    headline: "Bob claims Guerrilla",
    detail: "To attack Dave. Challenge the claim, or let it stand.",
    options: [
      { label: "Challenge", tone: "primary" },
      { label: "Pass", tone: "ghost" },
    ],
  },
  turn: {
    kicker: "Your turn",
    headline: "Choose an action",
    detail: "2 coins. Income is always safe. Claim a role to act.",
    options: [
      { label: "Income", tone: "ghost" },
      { label: "Coup", tone: "danger" },
    ],
  },
  terminal: {
    kicker: "Game over",
    headline: "Alice wins",
    detail: "Last player standing after 6 turns.",
    options: [{ label: "Back to rooms", tone: "primary" }],
  },
}

const prompt = computed(() => PROMPTS[scene.value])
const buttonVariant = (tone: PromptOption["tone"]) =>
  tone === "primary" ? "default" : tone === "danger" ? "destructive" : "outline"

const accentOf = (role: RoleId) => roleCardModel(role).accent
const nameOf = (role: RoleId) => roleCardModel(role).name
const initialOf = (role: RoleId) => roleCardModel(role).name.slice(0, 1)
</script>

<template>
  <div
    class="g54-proto flex min-h-dvh flex-col bg-background text-foreground"
    :data-variant="variant"
    :data-scene="scene"
  >
    <header class="flex items-center gap-3 border-b border-border px-4 py-3">
      <span class="text-sm font-semibold">Friday Coup</span>
      <Badge variant="secondary" class="tabular-nums">
        Turn {{ turn }}
      </Badge>
      <span class="text-muted-foreground text-sm">
        {{ activeSeat?.isMe ? "Your turn" : `${activeSeat?.name ?? "—"}'s turn` }}
      </span>
      <span class="ms-auto text-muted-foreground text-sm tabular-nums">Treasury {{ treasury }}</span>
    </header>

    <main class="flex flex-1 flex-col px-4 pb-32 pt-4">
      <!-- RING -->
      <template v-if="variant === 'ring'">
        <div class="relative mx-auto hidden min-h-[64vh] w-full max-w-5xl md:block">
          <div
            class="absolute inset-0 rounded-[2.5rem] bg-muted/30 ring-1 ring-foreground/5"
            style="background-image: radial-gradient(58% 58% at 50% 46%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 72%)"
          />

          <div class="absolute left-1/2 top-1/2 flex w-72 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center">
            <span class="text-muted-foreground text-xs tracking-widest uppercase">Court</span>
            <span class="text-3xl font-semibold tabular-nums">{{ courtCount }}</span>
            <div class="text-muted-foreground flex items-center gap-4 text-sm tabular-nums">
              <span>Treasury {{ treasury }}</span>
              <span>Bank {{ bank }}</span>
            </div>
            <div
              v-if="scene === 'challenge'"
              class="mt-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10"
            >
              <p class="text-muted-foreground text-xs tracking-widest uppercase">Claim</p>
              <p class="text-sm font-medium">Bob · Guerrilla → Dave</p>
            </div>
            <div v-else-if="scene === 'terminal'" class="mt-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10">
              <p class="text-muted-foreground text-xs tracking-widest uppercase">Winner</p>
              <p class="text-sm font-medium">Alice</p>
            </div>
          </div>

          <article
            v-for="seat in rivals"
            :key="seat.seat"
            class="absolute w-56 rounded-2xl bg-card p-3 ring-1 ring-foreground/10"
            :class="[
              seat.isActive && 'ring-2 ring-primary',
              seat.seat === 's2' ? 'left-1/2 top-2 -translate-x-1/2' : '',
              seat.seat === 's3' ? 'left-2 top-1/2 -translate-y-1/2' : '',
              seat.seat === 's4' ? 'right-2 top-1/2 -translate-y-1/2' : '',
            ]"
          >
            <div class="flex items-center gap-2">
              <Avatar class="h-8 w-8 rounded-full">
                <AvatarFallback class="rounded-full">{{ initialsOf(seat.name) }}</AvatarFallback>
              </Avatar>
              <div class="min-w-0">
                <p class="truncate text-sm leading-tight font-medium">{{ seat.name }}</p>
                <p class="text-muted-foreground text-xs leading-tight tabular-nums">{{ seat.coins }} coins</p>
              </div>
              <Badge v-if="seat.isActive" variant="secondary" class="ms-auto">Turn</Badge>
            </div>
            <div class="mt-2 flex items-center gap-1.5">
              <span
                v-for="n in seat.handCount"
                :key="`h${n}`"
                class="h-8 w-6 rounded-[5px] bg-neutral-900 ring-1 ring-foreground/20"
              />
              <span
                v-for="(role, i) in seat.revealed"
                :key="`r${i}`"
                class="grid h-8 w-6 place-items-center rounded-[5px] text-[10px] font-bold"
                :style="{ background: 'color-mix(in oklab, ' + accentOf(role) + ' 22%, var(--card))', color: accentOf(role) }"
                :title="nameOf(role)"
              >
                {{ initialOf(role) }}
              </span>
              <Badge v-if="seat.coins >= 10" variant="destructive" class="ms-auto">Forced coup</Badge>
            </div>
          </article>

          <div
            v-if="me"
            class="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-end gap-3 rounded-2xl bg-card p-3 ring-1 ring-foreground/10"
            :class="me.isActive && 'ring-2 ring-primary'"
          >
            <div class="flex items-center gap-2">
              <Avatar class="h-8 w-8 rounded-full">
                <AvatarFallback class="rounded-full">{{ initialsOf(me.name) }}</AvatarFallback>
              </Avatar>
              <div>
                <p class="text-sm leading-tight font-medium">You</p>
                <p class="text-muted-foreground text-xs leading-tight tabular-nums">{{ me.coins }} coins</p>
              </div>
            </div>
            <div class="flex gap-2">
              <RoleCard v-for="role in me.hand" :key="role" :role="role" class="w-24" />
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-3 md:hidden">
          <article
            v-for="seat in rivals"
            :key="seat.seat"
            class="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
            :class="seat.isActive && 'ring-2 ring-primary'"
          >
            <Avatar class="h-8 w-8 rounded-full">
              <AvatarFallback class="rounded-full">{{ initialsOf(seat.name) }}</AvatarFallback>
            </Avatar>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ seat.name }}</p>
              <p class="text-muted-foreground text-xs tabular-nums">{{ seat.coins }} coins</p>
            </div>
            <Badge v-if="seat.isActive" variant="secondary">Turn</Badge>
            <Badge v-if="seat.coins >= 10" variant="destructive">Forced coup</Badge>
            <div class="flex gap-1">
              <span v-for="n in seat.handCount" :key="`h${n}`" class="h-7 w-5 rounded-[4px] bg-neutral-900 ring-1 ring-foreground/20" />
            </div>
          </article>
          <div v-if="me" class="flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10" :class="me.isActive && 'ring-2 ring-primary'">
            <p class="text-sm font-medium">You · {{ me.coins }} coins</p>
            <div class="flex gap-2">
              <RoleCard v-for="role in me.hand" :key="role" :role="role" class="w-24" />
            </div>
          </div>
        </div>
      </template>

      <!-- FOCUS -->
      <template v-else-if="variant === 'focus'">
        <div class="mx-auto grid w-full max-w-5xl flex-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section class="flex flex-col gap-4">
            <div class="flex flex-1 flex-col items-center justify-center gap-5 rounded-3xl bg-muted/30 p-8 text-center ring-1 ring-foreground/5">
              <p class="text-muted-foreground text-xs tracking-widest uppercase">{{ prompt.kicker }}</p>
              <h1 class="text-3xl font-semibold text-balance">{{ prompt.headline }}</h1>
              <p class="text-muted-foreground max-w-md text-sm text-balance">{{ prompt.detail }}</p>
              <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  v-for="option in prompt.options"
                  :key="option.label"
                  size="lg"
                  :variant="buttonVariant(option.tone)"
                  :data-testid="`decision-${option.label.toLowerCase()}`"
                >
                  {{ option.label }}
                </Button>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
              <span class="text-muted-foreground text-xs tracking-widest uppercase">Board</span>
              <span
                v-for="role in ROLES"
                :key="role"
                class="rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-foreground/10"
                :style="{ background: 'color-mix(in oklab, ' + accentOf(role) + ' 16%, var(--card))' }"
              >
                {{ nameOf(role) }}
              </span>
              <span class="text-muted-foreground ms-auto text-xs tabular-nums">Court {{ courtCount }} · Treasury {{ treasury }}</span>
            </div>
          </section>

          <aside class="flex flex-col gap-2">
            <p class="text-muted-foreground text-xs tracking-widest uppercase">Table</p>
            <div
              v-for="seat in seats"
              :key="seat.seat"
              class="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10"
              :class="[seat.isActive && 'ring-2 ring-primary', seat.eliminated && 'opacity-60']"
            >
              <Avatar class="h-8 w-8 rounded-full">
                <AvatarFallback class="rounded-full">{{ initialsOf(seat.name) }}</AvatarFallback>
              </Avatar>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">
                  {{ seat.isMe ? "You" : seat.name }}
                </p>
                <p class="text-muted-foreground text-xs tabular-nums">{{ seat.coins }} coins</p>
              </div>
              <Badge v-if="seat.isActive" variant="secondary">Turn</Badge>
              <Badge v-else-if="seat.eliminated" variant="outline">Out</Badge>
              <div class="flex gap-1">
                <span v-for="n in seat.handCount" :key="`h${n}`" class="h-7 w-5 rounded-[4px] bg-neutral-900 ring-1 ring-foreground/20" />
              </div>
            </div>
          </aside>
        </div>
      </template>

      <!-- SPREAD -->
      <template v-else>
        <div class="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4">
          <div class="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
            <span class="text-muted-foreground text-xs tracking-widest uppercase">Roles</span>
            <span
              v-for="role in ROLES"
              :key="role"
              class="rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-foreground/10"
              :style="{ background: 'color-mix(in oklab, ' + accentOf(role) + ' 16%, var(--card))' }"
            >
              {{ nameOf(role) }}
            </span>
            <span class="text-muted-foreground ms-auto text-xs tabular-nums">
              Court {{ courtCount }} · Treasury {{ treasury }} · Bank {{ bank }}
            </span>
          </div>

          <div class="grid flex-1 auto-rows-min gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <article
              v-for="seat in seats"
              :key="seat.seat"
              class="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10"
              :class="[seat.isActive && 'ring-2 ring-primary', seat.eliminated && 'opacity-60']"
            >
              <div class="flex items-center gap-3">
                <Avatar class="h-9 w-9 rounded-full">
                  <AvatarFallback class="rounded-full">{{ initialsOf(seat.name) }}</AvatarFallback>
                </Avatar>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">{{ seat.isMe ? "You" : seat.name }}</p>
                  <p class="text-muted-foreground text-xs tabular-nums">{{ seat.coins }} coins</p>
                </div>
                <Badge v-if="seat.isActive" variant="secondary">Turn</Badge>
                <Badge v-else-if="seat.eliminated" variant="outline">Out</Badge>
              </div>
              <div class="flex flex-wrap items-end gap-2">
                <template v-if="seat.isMe">
                  <RoleCard v-for="role in seat.hand" :key="role" :role="role" class="w-24" />
                </template>
                <template v-else>
                  <span v-for="n in seat.handCount" :key="`h${n}`" class="h-9 w-7 rounded-[5px] bg-neutral-900 ring-1 ring-foreground/20" />
                </template>
                <span
                  v-for="(role, i) in seat.revealed"
                  :key="`r${i}`"
                  class="grid h-9 w-7 place-items-center rounded-[5px] text-[10px] font-bold"
                  :style="{ background: 'color-mix(in oklab, ' + accentOf(role) + ' 22%, var(--card))', color: accentOf(role) }"
                  :title="nameOf(role)"
                >
                  {{ initialOf(role) }}
                </span>
              </div>
            </article>
          </div>

          <div class="flex flex-col gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
            <p class="text-muted-foreground text-xs tracking-widest uppercase">{{ prompt.kicker }}</p>
            <p class="text-lg font-semibold text-balance">{{ prompt.headline }}</p>
            <p class="text-muted-foreground text-sm">{{ prompt.detail }}</p>
            <div class="flex flex-wrap items-center gap-2">
              <Button
                v-for="option in prompt.options"
                :key="option.label"
                :variant="buttonVariant(option.tone)"
                :data-testid="`decision-${option.label.toLowerCase()}`"
              >
                {{ option.label }}
              </Button>
              <template v-if="scene === 'turn'">
                <Button v-for="role in ROLES" :key="role" variant="secondary" size="sm">
                  {{ nameOf(role) }}
                </Button>
              </template>
            </div>
          </div>
        </div>
      </template>
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
.g54-proto .variant-picker,
.g54-proto .scene-picker {
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
.g54-proto .variant-picker {
  top: 12px;
}
.g54-proto .scene-picker {
  top: 56px;
  font-size: 12px;
}
.g54-proto .variant-picker button,
.g54-proto .scene-picker button {
  padding: 7px 14px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: rgb(255 255 255 / 0.6);
  cursor: pointer;
}
.g54-proto .variant-picker button:hover,
.g54-proto .scene-picker button:hover {
  color: rgb(255 255 255 / 0.85);
}
.g54-proto .variant-picker button[aria-current="true"],
.g54-proto .scene-picker button[aria-current="true"] {
  background: rgb(255 255 255 / 0.14);
  color: rgb(255 255 255);
}
.g54-proto .variant-picker button:focus-visible,
.g54-proto .scene-picker button:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.7);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .g54-proto *,
  .g54-proto *::before,
  .g54-proto *::after {
    transition: none !important;
    animation: none !important;
  }
}
</style>
