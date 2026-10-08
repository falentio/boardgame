import { watch, type Ref, type ShallowRef } from "vue"
import { toast } from "vue-sonner"
import type { G54View } from "#shared/core/lockstep/games/g54/index.ts"
import { specOf, type RoleId } from "#shared/core/lockstep/games/g54/roles.ts"
import type { WindowKind, WindowPurpose } from "#shared/core/lockstep/games/g54/state.ts"
import type { SeatId } from "#shared/rooms/ids.ts"
import type { SeatIdentity } from "./window-menu.ts"

export type Audience = "actor" | "room"
export type Importance = "toast" | "silent"
export type Severity = "success" | "info" | "warning" | "error"

/**
 * The facts a projection diff can emit. A member carries `seat` when it concerns
 * one seat; the room-wide kinds carry the seats their copy names instead, and
 * `renderToast` reads `seat` only to filter the actor rows.
 */
export type GameEvent =
  | { kind: "coins-gained"; seat: SeatId; amount: number; total: number }
  | { kind: "coins-lost"; seat: SeatId; amount: number; total: number }
  | { kind: "influence-lost"; seat: SeatId; remaining: number }
  | { kind: "eliminated"; seat: SeatId }
  | { kind: "resigned"; seat: SeatId }
  | { kind: "arms-reveal"; seat: SeatId; named: RoleId; cards: readonly RoleId[]; matched: boolean }
  | { kind: "card-gained"; seat: SeatId }
  | { kind: "turn-started"; seat: SeatId; turn: number }
  | { kind: "claim-opened"; seat: SeatId }
  | { kind: "targeted"; seat: SeatId }
  | { kind: "you-owe-input"; seat: SeatId }
  | { kind: "game-over"; winner: SeatId | null }
  | { kind: "claim-blocked"; blocker: SeatId; claimant: SeatId }
  | { kind: "treaty-formed"; seats: readonly [SeatId, SeatId] }
  | { kind: "treaty-expired"; seats: readonly [SeatId, SeatId] }
  | { kind: "peacekeeping-gained"; seat: SeatId }
  | { kind: "tax-marked"; holder: SeatId; role: RoleId }
  | { kind: "disappear-placed"; seat: SeatId; turns: number }
  | { kind: "bomb-placed"; seat: SeatId }
  | { kind: "bomb-passed"; to: SeatId; from: SeatId }
  | { kind: "bomb-defused"; seat: SeatId }

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

/**
 * The single source of truth: every kind decides audience, importance, and copy
 * here, so a kind without a row is a compile error. Only the Arms Dealer reveal
 * toasts; every other new kind is recorded silent because the board already
 * renders it.
 */
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
  resigned: {
    importance: "toast",
    audience: "room",
    severity: "warning",
    template: (event, names) => `${names(event.seat)} left the game.`,
  },
  // The two flipped cards shuffle straight back into the Court, so no board chip
  // can represent the reveal; a transient toast is its only surface.
  "arms-reveal": {
    importance: "toast",
    audience: "room",
    severity: "info",
    template: (event, names) => {
      const cards = event.cards.map((card) => specOf(card).name).join(", ")
      const named = specOf(event.named).name
      const outcome = event.matched ? `and matched ${named}` : `with no match for ${named}`
      return `${names(event.seat)} revealed ${cards} ${outcome}.`
    },
  },
  "card-gained": { importance: "silent" },
  "turn-started": { importance: "silent" },
  "claim-opened": { importance: "silent" },
  targeted: { importance: "silent" },
  "you-owe-input": { importance: "silent" },
  "game-over": { importance: "silent" },
  "claim-blocked": { importance: "silent" },
  "treaty-formed": { importance: "silent" },
  "treaty-expired": { importance: "silent" },
  "peacekeeping-gained": { importance: "silent" },
  "tax-marked": { importance: "silent" },
  "disappear-placed": { importance: "silent" },
  "bomb-placed": { importance: "silent" },
  "bomb-passed": { importance: "silent" },
  "bomb-defused": { importance: "silent" },
}

// --- the diff: typed per-field slices, computed once per interval -----------

const playerOf = (view: G54View, seat: SeatId): G54View["players"][number] | undefined =>
  view.players.find((player) => player.seat === seat)

export interface CoinChange {
  readonly seat: SeatId
  readonly delta: number
  readonly total: number
}
export interface CoinsDiff {
  readonly changes: readonly CoinChange[]
}

export const coinsDiff = (prev: G54View, next: G54View): CoinsDiff => {
  const changes: CoinChange[] = []
  for (const player of next.players) {
    const before = playerOf(prev, player.seat)
    if (before === undefined) continue
    const delta = player.coins - before.coins
    if (delta !== 0) changes.push({ seat: player.seat, delta, total: player.coins })
  }
  return { changes }
}

export interface CardLoss {
  readonly seat: SeatId
  readonly remaining: number
}
export interface RevealDiff {
  /** Losses that did not empty the hand. */
  readonly losses: readonly CardLoss[]
  readonly eliminated: ReadonlySet<SeatId>
  /** Every seat that lost a card this interval, eliminated or not. */
  readonly lostCard: ReadonlySet<SeatId>
}

/**
 * A loss is `revealed` growing, never a hand-count drop: a give moves a card into
 * a pool with no reveal, and a proven card is swapped at constant hand size, so a
 * hand-count gate would report a swap as a loss.
 */
export const revealDiff = (prev: G54View, next: G54View): RevealDiff => {
  const losses: CardLoss[] = []
  const eliminated = new Set<SeatId>()
  const lostCard = new Set<SeatId>()
  for (const player of next.players) {
    const before = playerOf(prev, player.seat)
    if (before === undefined) continue
    if (player.revealed.length <= before.revealed.length) continue
    lostCard.add(player.seat)
    if (player.handCount === 0) eliminated.add(player.seat)
    else losses.push({ seat: player.seat, remaining: player.handCount })
  }
  return { losses, eliminated, lostCard }
}

export interface HandDiff {
  readonly grew: readonly SeatId[]
}
export const handDiff = (prev: G54View, next: G54View): HandDiff => {
  const grew: SeatId[] = []
  for (const player of next.players) {
    const before = playerOf(prev, player.seat)
    if (before === undefined) continue
    if (player.handCount > before.handCount) grew.push(player.seat)
  }
  return { grew }
}

export interface ResignedDiff {
  readonly left: readonly SeatId[]
}
export const resignedDiff = (prev: G54View, next: G54View): ResignedDiff => {
  const left: SeatId[] = []
  for (const player of next.players) {
    const before = playerOf(prev, player.seat)
    if (before === undefined) continue
    if (!before.resigned && player.resigned) left.push(player.seat)
  }
  return { left }
}

export interface TurnDiff {
  readonly changed: boolean
  readonly active: SeatId
  readonly turn: number
}
export const turnDiff = (prev: G54View, next: G54View): TurnDiff => ({
  changed: next.turn !== prev.turn || next.active !== prev.active,
  active: next.active,
  turn: next.turn,
})

export interface PendingDiff {
  readonly opened: SeatId | null
  readonly blocked: { readonly blocker: SeatId; readonly claimant: SeatId } | null
  readonly targeted: SeatId | null
}

/**
 * `blocked` requires the same claim on both sides (claimant, role, target) so a
 * claim swap across the interval — a Spy second action, a mass claim's extra —
 * cannot misfire it. `targeted` gates on `prev.pending === null` because
 * `PendingView` is `activeClaim`: while a mass claim resolves, its target walks
 * every touched seat, and only the main claim's open names a genuine victim.
 */
export const pendingDiff = (prev: G54View, next: G54View): PendingDiff => {
  const before = prev.pending
  const after = next.pending
  const opened = before === null && after !== null ? after.claimant : null
  const blocked =
    before !== null &&
    after !== null &&
    before.claimant === after.claimant &&
    before.role === after.role &&
    before.target === after.target &&
    before.blocker === null &&
    after.blocker !== null
      ? { blocker: after.blocker, claimant: after.claimant }
      : null
  const targeted = before === null && after !== null ? after.target : null
  return { opened, blocked, targeted }
}

export interface OwedDiff {
  readonly gained: readonly SeatId[]
  readonly kind: WindowKind | null
  readonly purpose: WindowPurpose | null
}

export const owedDiff = (prev: G54View, next: G54View): OwedDiff => {
  const before = new Set(prev.owedSeats)
  const gained = next.owedSeats.filter((seat) => !before.has(seat))
  return { gained, kind: next.window?.kind ?? null, purpose: next.window?.purpose ?? null }
}

export interface TreatyDiff {
  readonly formed: readonly [SeatId, SeatId] | null
  readonly expired: readonly [SeatId, SeatId] | null
}
export interface PeacekeepingDiff {
  readonly gained: SeatId | null
}
export interface TaxDiff {
  readonly marked: { readonly holder: SeatId; readonly role: RoleId } | null
}
export interface DisappearDiff {
  readonly placed: readonly { readonly seat: SeatId; readonly turns: number }[]
}
export interface BombDiff {
  readonly placed: SeatId | null
  readonly passed: { readonly to: SeatId; readonly from: SeatId } | null
  /** The Bomb left the table: who held it and the move it had named. */
  readonly cleared: { readonly holder: SeatId; readonly move: "pass" | "defuse" | null } | null
}
export interface TokensDiff {
  readonly treaty: TreatyDiff
  readonly peacekeeping: PeacekeepingDiff
  readonly tax: TaxDiff
  readonly disappear: DisappearDiff
  readonly bomb: BombDiff
}

const pairOf = (seats: readonly SeatId[]): readonly [SeatId, SeatId] | null => {
  const [first, second] = seats
  return first === undefined || second === undefined ? null : [first, second]
}

export const tokensDiff = (prev: G54View, next: G54View): TokensDiff => {
  const beforeTreaty = pairOf(prev.tokens.treaty)
  const afterTreaty = pairOf(next.tokens.treaty)
  const formed = beforeTreaty === null && afterTreaty !== null ? afterTreaty : null
  const expired = beforeTreaty !== null && afterTreaty === null ? beforeTreaty : null

  const gained =
    prev.tokens.peacekeeping === null && next.tokens.peacekeeping !== null
      ? next.tokens.peacekeeping
      : null

  const beforeTax = prev.tokens.tax
  const afterTax = next.tokens.tax
  const marked =
    afterTax !== null &&
    (beforeTax === null || beforeTax.holder !== afterTax.holder || beforeTax.role !== afterTax.role)
      ? { holder: afterTax.holder, role: afterTax.role }
      : null

  const beforeDisappear = new Set(prev.tokens.disappear.map((token) => token.target))
  const placed = next.tokens.disappear
    .filter((token) => !beforeDisappear.has(token.target))
    .map((token) => ({ seat: token.target, turns: token.turns }))

  const beforeBomb = prev.tokens.bomb
  const afterBomb = next.tokens.bomb
  const bombPlaced = beforeBomb === null && afterBomb !== null ? afterBomb.holder : null
  const bombPassed =
    beforeBomb !== null && afterBomb !== null && beforeBomb.holder !== afterBomb.holder
      ? { to: afterBomb.holder, from: beforeBomb.holder }
      : null
  const bombCleared =
    beforeBomb !== null && afterBomb === null
      ? { holder: beforeBomb.holder, move: beforeBomb.move }
      : null

  return {
    treaty: { formed, expired },
    peacekeeping: { gained },
    tax: { marked },
    disappear: { placed },
    bomb: { placed: bombPlaced, passed: bombPassed, cleared: bombCleared },
  }
}

export interface ArmsRevealDiff {
  readonly seat: SeatId
  readonly named: RoleId
  readonly cards: readonly RoleId[]
  readonly matched: boolean
}
export interface ArmsDiff {
  readonly revealed: ArmsRevealDiff | null
}

const sameArms = (a: G54View["arms"], b: G54View["arms"]): boolean => {
  if (a === b) return true
  if (a === null || b === null) return false
  return (
    a.seat === b.seat &&
    a.named === b.named &&
    a.matched === b.matched &&
    a.cards.length === b.cards.length &&
    a.cards.every((card, index) => card === b.cards[index])
  )
}

/** `arms` is never reset, so a value diff is the only signal; an identical repeat is invisible. */
export const armsDiff = (prev: G54View, next: G54View): ArmsDiff => {
  if (next.arms === null || sameArms(prev.arms, next.arms)) return { revealed: null }
  return {
    revealed: {
      seat: next.arms.seat,
      named: next.arms.named,
      cards: [...next.arms.cards],
      matched: next.arms.matched,
    },
  }
}

export interface TerminalDiff {
  readonly ended: boolean
  readonly winner: SeatId | null
}
export const terminalDiff = (prev: G54View, next: G54View): TerminalDiff => ({
  ended: !prev.terminal && next.terminal,
  winner: next.winner,
})

export interface FrameDiff {
  readonly coins: CoinsDiff
  readonly reveal: RevealDiff
  readonly hand: HandDiff
  readonly resigned: ResignedDiff
  readonly turn: TurnDiff
  readonly pending: PendingDiff
  readonly owed: OwedDiff
  readonly tokens: TokensDiff
  readonly arms: ArmsDiff
  readonly terminal: TerminalDiff
}

export const diffOf = (prev: G54View, next: G54View): FrameDiff => ({
  coins: coinsDiff(prev, next),
  reveal: revealDiff(prev, next),
  hand: handDiff(prev, next),
  resigned: resignedDiff(prev, next),
  turn: turnDiff(prev, next),
  pending: pendingDiff(prev, next),
  owed: owedDiff(prev, next),
  tokens: tokensDiff(prev, next),
  arms: armsDiff(prev, next),
  terminal: terminalDiff(prev, next),
})

// --- detectors: one per event kind, typed to the slices it owns -------------

/** `settleNow` zeroes an eliminated seat's ledger, so its coin delta is bookkeeping, not a payment. */
export const detectCoinsGained = (
  coins: CoinsDiff,
  eliminated: ReadonlySet<SeatId>,
): readonly EventOf<"coins-gained">[] =>
  coins.changes
    .filter((change) => change.delta > 0 && !eliminated.has(change.seat))
    .map((change) => ({
      kind: "coins-gained",
      seat: change.seat,
      amount: change.delta,
      total: change.total,
    }))

export const detectCoinsLost = (
  coins: CoinsDiff,
  eliminated: ReadonlySet<SeatId>,
): readonly EventOf<"coins-lost">[] =>
  coins.changes
    .filter((change) => change.delta < 0 && !eliminated.has(change.seat))
    .map((change) => ({
      kind: "coins-lost",
      seat: change.seat,
      amount: -change.delta,
      total: change.total,
    }))

export const detectInfluenceLost = (reveal: RevealDiff): readonly EventOf<"influence-lost">[] =>
  reveal.losses.map((loss) => ({
    kind: "influence-lost",
    seat: loss.seat,
    remaining: loss.remaining,
  }))

export const detectElimination = (
  eliminated: ReadonlySet<SeatId>,
): readonly EventOf<"eliminated">[] =>
  [...eliminated].map((seat) => ({ kind: "eliminated", seat }))

export const detectCardGained = (hand: HandDiff): readonly EventOf<"card-gained">[] =>
  hand.grew.map((seat) => ({ kind: "card-gained", seat }))

export const detectResigned = (resigned: ResignedDiff): readonly EventOf<"resigned">[] =>
  resigned.left.map((seat) => ({ kind: "resigned", seat }))

export const detectTurnStarted = (turn: TurnDiff): readonly EventOf<"turn-started">[] =>
  turn.changed ? [{ kind: "turn-started", seat: turn.active, turn: turn.turn }] : []

export const detectClaimOpened = (pending: PendingDiff): readonly EventOf<"claim-opened">[] =>
  pending.opened === null ? [] : [{ kind: "claim-opened", seat: pending.opened }]

export const detectClaimBlocked = (pending: PendingDiff): readonly EventOf<"claim-blocked">[] =>
  pending.blocked === null
    ? []
    : [
        {
          kind: "claim-blocked",
          blocker: pending.blocked.blocker,
          claimant: pending.blocked.claimant,
        },
      ]

export const detectTargeted = (pending: PendingDiff): readonly EventOf<"targeted">[] =>
  pending.targeted === null ? [] : [{ kind: "targeted", seat: pending.targeted }]

/** Broadcast (`any`) windows owe every seat and auto-pass the claimant/blocker, so a self cue there is noise. */
export const detectYouOweInput = (owed: OwedDiff): readonly EventOf<"you-owe-input">[] =>
  owed.kind === "any" ? [] : owed.gained.map((seat) => ({ kind: "you-owe-input", seat }))

export const detectTreatyFormed = (treaty: TreatyDiff): readonly EventOf<"treaty-formed">[] =>
  treaty.formed === null ? [] : [{ kind: "treaty-formed", seats: treaty.formed }]

/** A member leaving empties the treaty via `expireTreaty`, and its own toast already reports the cause. */
export const detectTreatyExpired = (
  treaty: TreatyDiff,
  eliminated: ReadonlySet<SeatId>,
  resigned: readonly SeatId[],
): readonly EventOf<"treaty-expired">[] => {
  if (treaty.expired === null) return []
  const [first, second] = treaty.expired
  if (
    eliminated.has(first) ||
    eliminated.has(second) ||
    resigned.includes(first) ||
    resigned.includes(second)
  ) {
    return []
  }
  return [{ kind: "treaty-expired", seats: treaty.expired }]
}

/** Only a null -> seat gain counts: a fresh view per frame makes a "held" check always true. */
export const detectPeacekeepingGained = (
  peacekeeping: PeacekeepingDiff,
): readonly EventOf<"peacekeeping-gained">[] =>
  peacekeeping.gained === null ? [] : [{ kind: "peacekeeping-gained", seat: peacekeeping.gained }]

export const detectBombPlaced = (bomb: BombDiff): readonly EventOf<"bomb-placed">[] =>
  bomb.placed === null ? [] : [{ kind: "bomb-placed", seat: bomb.placed }]

export const detectBombPassed = (bomb: BombDiff): readonly EventOf<"bomb-passed">[] =>
  bomb.passed === null ? [] : [{ kind: "bomb-passed", to: bomb.passed.to, from: bomb.passed.from }]

/** A caught defuse claim also clears the Bomb and reveals the holder; that explosion is `influence-lost`. */
export const detectBombDefused = (
  bomb: BombDiff,
  lostCard: ReadonlySet<SeatId>,
): readonly EventOf<"bomb-defused">[] =>
  bomb.cleared !== null && bomb.cleared.move === "defuse" && !lostCard.has(bomb.cleared.holder)
    ? [{ kind: "bomb-defused", seat: bomb.cleared.holder }]
    : []

export const detectTaxMarked = (tax: TaxDiff): readonly EventOf<"tax-marked">[] =>
  tax.marked === null
    ? []
    : [{ kind: "tax-marked", holder: tax.marked.holder, role: tax.marked.role }]

export const detectDisappearPlaced = (
  disappear: DisappearDiff,
): readonly EventOf<"disappear-placed">[] =>
  disappear.placed.map((placed) => ({
    kind: "disappear-placed",
    seat: placed.seat,
    turns: placed.turns,
  }))

export const detectArmsReveal = (arms: ArmsDiff): readonly EventOf<"arms-reveal">[] =>
  arms.revealed === null
    ? []
    : [
        {
          kind: "arms-reveal",
          seat: arms.revealed.seat,
          named: arms.revealed.named,
          cards: arms.revealed.cards,
          matched: arms.revealed.matched,
        },
      ]

export const detectGameOver = (terminal: TerminalDiff): readonly EventOf<"game-over">[] =>
  terminal.ended ? [{ kind: "game-over", winner: terminal.winner }] : []

/** A registered detector: takes the whole diff, reads only the slices its body names. */
export type Detector = (diff: FrameDiff) => readonly GameEvent[]

/**
 * The detection list. One line per event kind; the line is the ownership
 * declaration. Adding an event is one union member, one detect function, one line
 * here, and one CATALOGUE row — nothing else.
 */
export const DETECTORS: readonly Detector[] = [
  (diff) => detectInfluenceLost(diff.reveal),
  (diff) => detectElimination(diff.reveal.eliminated),
  (diff) => detectCardGained(diff.hand),
  (diff) => detectResigned(diff.resigned),
  (diff) => detectCoinsGained(diff.coins, diff.reveal.eliminated),
  (diff) => detectCoinsLost(diff.coins, diff.reveal.eliminated),
  (diff) => detectTurnStarted(diff.turn),
  (diff) => detectClaimOpened(diff.pending),
  (diff) => detectClaimBlocked(diff.pending),
  (diff) => detectTargeted(diff.pending),
  (diff) => detectYouOweInput(diff.owed),
  (diff) => detectTreatyFormed(diff.tokens.treaty),
  (diff) => detectTreatyExpired(diff.tokens.treaty, diff.reveal.eliminated, diff.resigned.left),
  (diff) => detectPeacekeepingGained(diff.tokens.peacekeeping),
  (diff) => detectBombPlaced(diff.tokens.bomb),
  (diff) => detectBombPassed(diff.tokens.bomb),
  (diff) => detectBombDefused(diff.tokens.bomb, diff.reveal.lostCard),
  (diff) => detectTaxMarked(diff.tokens.tax),
  (diff) => detectDisappearPlaced(diff.tokens.disappear),
  (diff) => detectArmsReveal(diff.arms),
  (diff) => detectGameOver(diff.terminal),
]

export const deriveEvents = (prev: G54View, next: G54View): readonly GameEvent[] => {
  const diff = diffOf(prev, next)
  return DETECTORS.flatMap((detect) => detect(diff))
}

/** Only actor rows are filtered by seat, and every actor row carries one. */
const seatOf = (event: GameEvent): SeatId | null => ("seat" in event ? event.seat : null)

const renderToast = <K extends GameEvent["kind"]>(
  event: EventOf<K>,
  viewer: SeatId,
  names: SeatNames,
): Toast | null => {
  const row: ToastRow<K> | SilentRow = CATALOGUE[event.kind]
  if (row.importance !== "toast") return null
  if (row.audience === "actor" && seatOf(event) !== viewer) return null
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
