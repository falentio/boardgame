import type { SeatId } from "#shared/rooms/ids.ts"
import type { RoleId } from "#shared/core/lockstep/games/g54/roles.ts"
import { specOf } from "#shared/core/lockstep/games/g54/roles.ts"
import type { WindowPurpose } from "#shared/core/lockstep/games/g54/state.ts"
import type { G54View, PendingView, WindowView } from "#shared/core/lockstep/games/g54/index.ts"
import { menuOf, type WindowMenu } from "./window-menu.ts"

export type BoardPhase = "idle" | "acting" | "targeted" | "owed"

/**
 * Short plain label for the open window's purpose. Exhaustive over every purpose
 * so a new engine purpose is a compile error, not a blank status line.
 */
const PURPOSE_LABELS: Record<WindowPurpose, string> = {
  turn: "Your turn",
  "challenge-claim": "Challenge a claim",
  "proof-claim": "Prove a claim",
  block: "Block an action",
  "challenge-block": "Challenge a block",
  "proof-block": "Prove a block",
  reveal: "Reveal a card",
  keep: "Choose cards to keep",
  "crime-pay": "Crime Boss payment",
  capitalist: "Capitalist claims",
  "spy-second": "Second action",
  "protestor-fund": "Fund the protest",
  "producer-give": "Give a card",
  "writer-draw": "Extra draw",
  "customs-mark": "Mark a role",
  "reactive-intellectual": "Claim Intellectual",
  "reactive-missionary": "Claim Missionary",
  lawyer: "Claim the estate",
  bomb: "The Bomb",
  "socialist-give": "Give to the Socialist",
  "socialist-keep": "Socialist swap",
  "plantation-payout": "Plantation payout",
}

export const purposeLabel = (purpose: WindowPurpose): string => PURPOSE_LABELS[purpose]

export interface BoardToken {
  readonly id: string
  readonly label: string
  readonly art: string | null
}

export interface BoardSeat {
  readonly seat: SeatId
  readonly name: string
  readonly image: string | null
  readonly isMe: boolean
  readonly coins: number
  /** Face-up cards: the viewer's own hand. Empty for every other seat. */
  readonly hand: readonly RoleId[]
  /** Face-down cards held by a rival. Zero for the viewer. */
  readonly handCount: number
  readonly revealed: readonly RoleId[]
  readonly phase: BoardPhase
  readonly tokens: readonly BoardToken[]
}

export interface BoardTable {
  readonly roles: readonly RoleId[]
  readonly treasury: number
  readonly bank: number
  readonly courtCount: number
  readonly turn: number
  readonly pending: string | null
  readonly terminal: boolean
  /** The open window the engine waits on, or null between windows. */
  readonly window: WindowView | null
  /** The seats the open window owes input from. */
  readonly owedSeats: readonly SeatId[]
}

export interface Board {
  readonly table: BoardTable
  readonly seats: readonly BoardSeat[]
  /** The controls for the viewer's open window, or null when they owe nothing. */
  readonly menu: WindowMenu | null
}

export interface SeatIdentity {
  readonly name: string
  readonly image: string | null
}

const TOKEN_ART = {
  peacekeeping: "/g54/token/peacekeeping.webp",
  treaty: "/g54/token/treaty.webp",
  tax: "/g54/token/tax.webp",
  disappear: "/g54/role-categories/disappear.webp",
} as const

const tokensFor = (view: G54View, seat: SeatId): readonly BoardToken[] => {
  const tokens: BoardToken[] = []
  const { peacekeeping, treaty, tax, disappear, bomb } = view.tokens
  if (peacekeeping === seat) {
    tokens.push({ id: "peacekeeping", label: "Peacekeeping", art: TOKEN_ART.peacekeeping })
  }
  if (treaty.includes(seat)) {
    tokens.push({ id: "treaty", label: "Treaty", art: TOKEN_ART.treaty })
  }
  if (tax !== null && tax.holder === seat) {
    tokens.push({ id: "tax", label: `Tax ${specOf(tax.role).name}`, art: TOKEN_ART.tax })
  }
  if (disappear.some((token) => token.target === seat)) {
    tokens.push({ id: "disappear", label: "Disappear", art: TOKEN_ART.disappear })
  }
  if (bomb !== null && bomb.holder === seat) {
    tokens.push({ id: "bomb", label: "Bomb", art: null })
  }
  return tokens
}

const phaseOf = (view: G54View, seat: SeatId): BoardPhase => {
  if (seat === view.active) return "acting"
  if (view.pending !== null && view.pending.target === seat) return "targeted"
  if (view.owedSeats.includes(seat)) return "owed"
  return "idle"
}

const pendingLabel = (
  pending: PendingView | null,
  nameOf: (seat: SeatId) => string,
): string | null => {
  if (pending === null) return null
  const actor = nameOf(pending.claimant)
  const role = pending.role === null ? "an action" : specOf(pending.role).name
  const claim = `${actor} claims ${role}`
  return pending.target === null ? claim : `${claim} on ${nameOf(pending.target)}`
}

export const boardOf = (
  view: G54View,
  identities: ReadonlyMap<SeatId, SeatIdentity>,
): Board => {
  const nameOf = (seat: SeatId): string => identities.get(seat)?.name ?? seat
  const seats = view.players.map((player): BoardSeat => {
    const identity = identities.get(player.seat)
    const isMe = player.seat === view.seat
    return {
      seat: player.seat,
      name: identity?.name ?? player.seat,
      image: identity?.image ?? null,
      isMe,
      coins: player.coins,
      hand: isMe ? [...view.myHand] : [],
      handCount: isMe ? 0 : player.handCount,
      revealed: [...player.revealed],
      phase: phaseOf(view, player.seat),
      tokens: tokensFor(view, player.seat),
    }
  })
  return {
    table: {
      roles: [...view.roles],
      treasury: view.treasury,
      bank: view.bank,
      courtCount: view.courtCount,
      turn: view.turn,
      pending: pendingLabel(view.pending, nameOf),
      terminal: view.terminal,
      window: view.window,
      owedSeats: [...view.owedSeats],
    },
    seats,
    menu: menuOf(view, view.seat, nameOf),
  }
}
