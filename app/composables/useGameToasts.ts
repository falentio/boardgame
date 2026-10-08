import { watch, type Ref, type ShallowRef } from "vue"
import { toast } from "vue-sonner"
import type { G54View } from "#shared/core/lockstep/games/g54/index.ts"
import type { SeatId } from "#shared/rooms/ids.ts"
import type { SeatIdentity } from "./window-menu.ts"

export type Audience = "actor" | "room"
export type Importance = "toast" | "silent"
export type Severity = "success" | "info" | "warning" | "error"

export type GameEvent =
  | { kind: "coins-gained"; seat: SeatId; amount: number; total: number }
  | { kind: "coins-lost"; seat: SeatId; amount: number; total: number }
  | { kind: "influence-lost"; seat: SeatId; remaining: number }
  | { kind: "eliminated"; seat: SeatId }
  | { kind: "card-gained"; seat: SeatId }
  | { kind: "resigned"; seat: SeatId }
  | { kind: "turn-started"; seat: SeatId; turn: number }
  | { kind: "claim-opened"; seat: SeatId }

export type EventOf<K extends GameEvent["kind"]> = Extract<GameEvent, { kind: K }>

/** Resolves a seat to its display name, falling back to the seat id. */
export type SeatNames = (seat: SeatId) => string

export interface ToastRow<K extends GameEvent["kind"]> {
  importance: "toast"
  audience: Audience
  severity: Severity
  template(event: EventOf<K>, names: SeatNames): string
}

/** A deliberate non-toast: the row carries no copy, so it cannot drift from the decision. */
export interface SilentRow {
  importance: "silent"
}

export type EventCatalogue = { readonly [K in GameEvent["kind"]]: ToastRow<K> | SilentRow }

export interface Toast {
  severity: Severity
  title: string
}

export interface ToastSink {
  show(toast: Toast): void
}

const coins = (count: number): string => `${String(count)} ${count === 1 ? "coin" : "coins"}`

export const CATALOGUE: EventCatalogue = {
  "coins-gained": {
    importance: "toast",
    audience: "actor",
    severity: "success",
    template: (event) => `You gained ${coins(event.amount)} (${String(event.total)} total).`,
  },
  "coins-lost": {
    importance: "toast",
    audience: "actor",
    severity: "warning",
    template: (event) => `You paid ${coins(event.amount)} (${String(event.total)} total).`,
  },
  "influence-lost": {
    importance: "toast",
    audience: "room",
    severity: "warning",
    template: (event, names) =>
      `${names(event.seat)} lost a card (${String(event.remaining)} left).`,
  },
  eliminated: {
    importance: "toast",
    audience: "room",
    severity: "error",
    template: (event, names) => `${names(event.seat)} is out of the game.`,
  },
  "card-gained": { importance: "silent" },
  resigned: {
    importance: "toast",
    audience: "room",
    severity: "warning",
    template: (event, names) => `${names(event.seat)} left the game.`,
  },
  "turn-started": { importance: "silent" },
  "claim-opened": { importance: "silent" },
}

const playerOf = (view: G54View, seat: SeatId): G54View["players"][number] | undefined =>
  view.players.find((player) => player.seat === seat)

/**
 * Diff two projections into facts, with no audience or importance policy. A card
 * is lost when `revealed` grows, never when a hand count falls: a give moves a
 * card into a pool with no reveal, and a proven card is swapped at constant hand
 * size, so a hand-count gate would toast a swap as a loss.
 */
export const deriveEvents = (prev: G54View, next: G54View): readonly GameEvent[] => {
  const events: GameEvent[] = []
  const eliminated = new Set<SeatId>()
  for (const player of next.players) {
    const before = playerOf(prev, player.seat)
    if (before === undefined) continue
    if (player.revealed.length > before.revealed.length) {
      if (player.handCount === 0) {
        events.push({ kind: "eliminated", seat: player.seat })
        eliminated.add(player.seat)
      } else {
        events.push({ kind: "influence-lost", seat: player.seat, remaining: player.handCount })
      }
    }
    if (player.handCount > before.handCount) {
      events.push({ kind: "card-gained", seat: player.seat })
    }
    if (!before.resigned && player.resigned) {
      events.push({ kind: "resigned", seat: player.seat })
    }
  }
  for (const player of next.players) {
    const before = playerOf(prev, player.seat)
    if (before === undefined || eliminated.has(player.seat)) continue
    const delta = player.coins - before.coins
    if (delta > 0) {
      events.push({ kind: "coins-gained", seat: player.seat, amount: delta, total: player.coins })
    } else if (delta < 0) {
      events.push({ kind: "coins-lost", seat: player.seat, amount: -delta, total: player.coins })
    }
  }
  if (next.turn !== prev.turn || next.active !== prev.active) {
    events.push({ kind: "turn-started", seat: next.active, turn: next.turn })
  }
  if (prev.pending === null && next.pending !== null) {
    events.push({ kind: "claim-opened", seat: next.pending.claimant })
  }
  return events
}

const renderToast = <K extends GameEvent["kind"]>(
  event: EventOf<K>,
  viewer: SeatId,
  names: SeatNames,
): Toast | null => {
  const row: ToastRow<K> | SilentRow = CATALOGUE[event.kind]
  if (row.importance !== "toast") return null
  if (row.audience === "actor" && event.seat !== viewer) return null
  return { severity: row.severity, title: row.template(event, names) }
}

/**
 * The toasts one seat sees between two projections. `prev === null` is the mount
 * baseline and yields nothing; the caller owns every other policy decision.
 */
export const toastsFor = (
  prev: G54View | null,
  next: G54View,
  viewer: SeatId,
  names: SeatNames,
): readonly Toast[] => {
  if (prev === null) return []
  const toasts: Toast[] = []
  for (const event of deriveEvents(prev, next)) {
    const toast = renderToast(event, viewer, names)
    if (toast !== null) toasts.push(toast)
  }
  return toasts
}

/**
 * True when `next` continues `prev` rather than a resync or a fresh mount: the
 * same seat, a predecessor still in play, and a turn that has not gone backwards.
 */
export const isContinuation = (prev: G54View, next: G54View): boolean =>
  prev.seat === next.seat && !prev.terminal && next.turn >= prev.turn

export const sonnerSink: ToastSink = {
  show: ({ severity, title }) => {
    toast[severity](title)
  },
}

export const useGameToasts = (deps: {
  readonly view: ShallowRef<G54View | null>
  readonly identities: Ref<ReadonlyMap<SeatId, SeatIdentity>>
  readonly sink?: ToastSink
}): void => {
  const sink = deps.sink ?? sonnerSink
  let previous: G54View | null = null

  const nameOf = (seat: SeatId): string => deps.identities.value.get(seat)?.name ?? seat

  watch(
    deps.view,
    (next) => {
      if (next === null) {
        previous = null
        return
      }
      const before = previous
      previous = next
      if (before === null || !isContinuation(before, next)) return
      for (const toast of toastsFor(before, next, next.seat, nameOf)) sink.show(toast)
    },
    { flush: "sync" },
  )
}
