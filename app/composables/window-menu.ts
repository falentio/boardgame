import type { SeatId } from "#shared/rooms/ids.ts"
import type { G54Action, G54View, PlayerView } from "#shared/core/lockstep/games/g54/index.ts"
import { claimCost, specOf, type RoleId, type RoleSpec } from "#shared/core/lockstep/games/g54/roles.ts"
import type { GeneralActionId } from "#shared/core/lockstep/games/g54/generals.ts"
import { GENERAL_ACTIONS } from "#shared/core/lockstep/games/g54/generals.ts"
import { GENERAL_LABELS } from "./general-card.ts"
import { COUP_COST, FORCED_COUP_COINS } from "#shared/core/lockstep/games/g54/windows.ts"

/**
 * One selectable target for a `target` option. The name is resolved here so the
 * component never needs the identity map; `enabled` is false when the engine
 * would reject this specific target, so the picker can disable it.
 */
export interface MenuSeatChoice {
  readonly seat: SeatId
  readonly name: string
  readonly enabled: boolean
  readonly reason: string | null
}

/** One selectable card for a `card` or `cards` option, identified by its position. */
export interface MenuCardChoice {
  readonly index: number
  readonly name: string
}

/** One selectable role for a `role` option, identified by its role id. */
export interface MenuRoleChoice {
  readonly role: RoleId
  readonly name: string
}

/**
 * The card identity of a turn option. Only the turn window sets a face; every
 * other window leaves it null and renders buttons.
 */
export type MenuFace =
  | { readonly kind: "role"; readonly role: RoleId }
  | { readonly kind: "general"; readonly action: GeneralActionId }

/**
 * One control the open window offers the viewer. The `kind` names the control and
 * the arm's `action` takes exactly the value that control produces, so a `target`
 * option cannot ship an action that ignores its target.
 */
export type MenuOption =
  | {
      readonly id: string
      readonly kind: "plain"
      readonly label: string
      readonly detail: string | null
      readonly enabled: boolean
      /** Why the option is disabled; null when it is enabled. */
      readonly reason: string | null
      /** The card identity for the turn selector, or null outside the turn window. */
      readonly face: MenuFace | null
      readonly action: () => G54Action
    }
  | {
      readonly id: string
      readonly kind: "target"
      readonly label: string
      readonly detail: string | null
      readonly enabled: boolean
      /** Why the option is disabled; null when it is enabled. */
      readonly reason: string | null
      /** The card identity for the turn selector, or null outside the turn window. */
      readonly face: MenuFace | null
      readonly choices: readonly MenuSeatChoice[]
      readonly action: (seat: SeatId) => G54Action
    }
  | {
      readonly id: string
      readonly kind: "card"
      readonly label: string
      readonly detail: string | null
      readonly enabled: boolean
      /** Why the option is disabled; null when it is enabled. */
      readonly reason: string | null
      readonly choices: readonly MenuCardChoice[]
      readonly action: (index: number) => G54Action
    }
  | {
      readonly id: string
      readonly kind: "cards"
      readonly label: string
      readonly detail: string | null
      readonly enabled: boolean
      /** Why the option is disabled; null when it is enabled. */
      readonly reason: string | null
      /** How many cards the engine accepts: the keep size. */
      readonly count: number
      readonly choices: readonly MenuCardChoice[]
      readonly action: (indices: readonly number[]) => G54Action
    }
  | {
      readonly id: string
      readonly kind: "role"
      readonly label: string
      readonly detail: string | null
      readonly enabled: boolean
      /** Why the option is disabled; null when it is enabled. */
      readonly reason: string | null
      readonly choices: readonly MenuRoleChoice[]
      readonly action: (role: RoleId) => G54Action
    }
  | {
      readonly id: string
      readonly kind: "swap"
      readonly label: string
      readonly detail: string | null
      readonly enabled: boolean
      /** Why the option is disabled; null when it is enabled. */
      readonly reason: string | null
      /** The viewer's own hand, indexed into `hand`. */
      readonly ownChoices: readonly MenuCardChoice[]
      /** The collected pile, indexed into `hand + pool` as the engine reads it. */
      readonly poolChoices: readonly MenuCardChoice[]
      readonly action: (ownIndex: number, keepIndex: number) => G54Action
    }

/** The controls for the open window, or null when the viewer owes nothing here. */
export interface WindowMenu {
  readonly title: string
  readonly note: string | null
  readonly options: readonly MenuOption[]
}

/**
 * True when every option carries a card face, so the turn selector renders cards.
 * Only the plain turn window sets a face on each option; every other window leaves
 * them null, including `spy-second`, whose Stop has no card.
 */
export const isTurnMenu = (menu: WindowMenu): boolean =>
  menu.options.length > 0 &&
  menu.options.every(
    (option) => (option.kind === "plain" || option.kind === "target") && option.face !== null,
  )

const PLAIN_GENERALS: Record<Exclude<GeneralActionId, "coup">, () => G54Action> = {
  income: () => ({ t: "income" }),
  bank: () => ({ t: "bank" }),
  "social-media": () => ({ t: "social-media" }),
}

const FORCED_COUP_REASON = `At ${String(FORCED_COUP_COINS)} coins Coup is forced`
const NO_TARGET = "No legal target"

const CRIME_PAY_COST = 2
const FUND_COST = 3
const WRITER_EXTRA_COST = 1

const shortOf = (cost: number): string => `Needs ${String(cost)} coins`

const coinsOf = (view: G54View, seat: SeatId): number =>
  view.players.find((player) => player.seat === seat)?.coins ?? 0

/** Both seats of a two-seat Treaty spare each other, mirroring `isAlly` in the engine. */
const isTreatyAlly = (treaty: readonly SeatId[], claimant: SeatId, seat: SeatId): boolean =>
  treaty.length === 2 && treaty.includes(claimant) && treaty.includes(seat)

/**
 * The rivals the engine will accept as a target. A resigned seat is never a
 * target: the Coup path filters through `otherAlive` (which is `aliveSeats` minus
 * the actor, and `aliveSeats` drops a resigned seat), and `targetable` itself
 * rejects one. `peacekeeperImmune` mirrors the engine split: a general target
 * spares the Peacekeeper, a Coup does not.
 *
 * Two target rules stay in the engine: Communist picks its own victim, and the
 * Anarchist prior-holder set is not projected. Each is coerced there rather than
 * offered here.
 */
const rivalTargets = (
  view: G54View,
  claimant: SeatId,
  peacekeeperImmune: boolean,
): readonly PlayerView[] =>
  view.players.filter(
    (player) =>
      player.seat !== claimant &&
      player.handCount > 0 &&
      !player.resigned &&
      !isTreatyAlly(view.tokens.treaty, claimant, player.seat) &&
      !(peacekeeperImmune && view.tokens.peacekeeping === player.seat),
  )

const targetChoices = (
  rivals: readonly PlayerView[],
  nameOf: (seat: SeatId) => string,
  costOf: (player: PlayerView) => number,
  coins: number,
): readonly MenuSeatChoice[] =>
  rivals.map((player) => {
    const cost = costOf(player)
    const affordable = coins >= cost
    return {
      seat: player.seat,
      name: nameOf(player.seat),
      enabled: affordable,
      reason: affordable ? null : shortOf(cost),
    }
  })

const costDetail = (spec: RoleSpec): string | null => {
  const byLives = spec.costByTargetLives
  if (byLives === undefined) return spec.cost > 0 ? `Costs ${String(spec.cost)}` : null
  const values = Object.values(byLives)
  return `Costs ${String(Math.min(...values))}–${String(Math.max(...values))}`
}

const plain = (
  id: string,
  label: string,
  detail: string | null,
  enabled: boolean,
  reason: string | null,
  action: () => G54Action,
): MenuOption => ({ id, kind: "plain", label, detail, enabled, reason, face: null, action })

const turnMenu = (view: G54View, seat: SeatId, nameOf: (seat: SeatId) => string): WindowMenu => {
  const coins = coinsOf(view, seat)
  const forcedCoup = coins >= FORCED_COUP_COINS

  const coupChoices = targetChoices(rivalTargets(view, seat, false), nameOf, () => COUP_COST, coins)
  const coupEnabled = coins >= COUP_COST && coupChoices.some((choice) => choice.enabled)
  const coupOption: MenuOption = {
    id: "coup",
    kind: "target",
    label: GENERAL_LABELS.coup,
    detail: GENERAL_ACTIONS.coup.summary,
    enabled: coupEnabled,
    reason: coupChoices.length === 0 ? NO_TARGET : coupEnabled ? null : shortOf(COUP_COST),
    face: { kind: "general", action: "coup" },
    choices: coupChoices,
    action: (target) => ({ t: "coup", target }),
  }

  const generals = view.generalActions.map((id): MenuOption => {
    if (id === "coup") return coupOption
    return {
      id,
      kind: "plain",
      label: GENERAL_LABELS[id],
      detail: GENERAL_ACTIONS[id].summary,
      enabled: !forcedCoup,
      reason: forcedCoup ? FORCED_COUP_REASON : null,
      face: { kind: "general", action: id },
      action: PLAIN_GENERALS[id],
    }
  })

  const rivals = rivalTargets(view, seat, true)

  const claims = view.roles
    .map(specOf)
    .filter((spec) => !spec.reactive)
    .map((spec): MenuOption => {
      const label = `Claim ${spec.name}`
      const detail = costDetail(spec)
      if (spec.needsTarget) {
        const choices = targetChoices(
          rivals,
          nameOf,
          (player) => claimCost(spec, player.handCount),
          coins,
        )
        const costs = rivals.map((player) => claimCost(spec, player.handCount))
        const anyAffordable = costs.some((cost) => coins >= cost)
        const enabled = !forcedCoup && anyAffordable
        const reason = forcedCoup
          ? FORCED_COUP_REASON
          : rivals.length === 0
            ? NO_TARGET
            : anyAffordable
              ? null
              : shortOf(costs.length === 0 ? spec.cost : Math.min(...costs))
        return {
          id: `claim-${spec.id}`,
          kind: "target",
          label,
          detail,
          enabled,
          reason,
          face: { kind: "role", role: spec.id },
          choices,
          action: (target) => ({ t: "claim", role: spec.id, target }),
        }
      }
      const cost = claimCost(spec, 0)
      const affordable = coins >= cost
      return {
        id: `claim-${spec.id}`,
        kind: "plain",
        label,
        detail,
        enabled: !forcedCoup && affordable,
        reason: forcedCoup ? FORCED_COUP_REASON : affordable ? null : shortOf(cost),
        face: { kind: "role", role: spec.id },
        action: () => ({ t: "claim", role: spec.id, target: null }),
      }
    })

  return {
    title: "Your turn",
    note: forcedCoup ? FORCED_COUP_REASON : null,
    options: [...generals, ...claims],
  }
}

const claimNote = (view: G54View, nameOf: (seat: SeatId) => string): string | null => {
  const pending = view.pending
  if (pending === null) return null
  const actor = nameOf(pending.claimant)
  if (pending.role === null) return `${actor} acts`
  const role = specOf(pending.role).name
  return pending.target === null
    ? `${actor} claims ${role}`
    : `${actor} claims ${role} on ${nameOf(pending.target)}`
}

const challengeMenu = (
  view: G54View,
  seat: SeatId,
  purpose: "challenge-claim" | "challenge-block",
  nameOf: (seat: SeatId) => string,
): WindowMenu => {
  const pending = view.pending
  // The engine skips the claimant and the blocker when it picks a challenger, so
  // their Challenge is ignored; offer them Pass alone.
  const mayChallenge =
    pending !== null &&
    (purpose === "challenge-claim" ? seat !== pending.claimant : seat !== pending.blocker)
  const options: MenuOption[] = []
  if (mayChallenge) {
    options.push(plain("challenge", "Challenge", null, true, null, () => ({ t: "challenge" })))
  }
  options.push(plain("pass", "Pass", null, true, null, () => ({ t: "pass" })))
  return {
    title: purpose === "challenge-claim" ? "Challenge the claim" : "Challenge the block",
    note: claimNote(view, nameOf),
    options,
  }
}

/** The card the viewer must hold to show: the claimed role, or the claim's block role. */
const proofSpec = (view: G54View, purpose: "proof-claim" | "proof-block"): RoleSpec | null => {
  const pending = view.pending
  if (pending === null || pending.role === null) return null
  if (purpose === "proof-claim") return specOf(pending.role)
  const blockRole = specOf(pending.role).blockRole
  return blockRole === null ? null : specOf(blockRole)
}

const proofMenu = (
  view: G54View,
  purpose: "proof-claim" | "proof-block",
  nameOf: (seat: SeatId) => string,
): WindowMenu => {
  const spec = proofSpec(view, purpose)
  const holds = spec !== null && view.myHand.includes(spec.id)
  const show = plain(
    "show",
    "Show",
    spec === null ? null : spec.name,
    holds,
    holds || spec === null ? null : `You do not hold ${spec.name}`,
    () => ({ t: "show" }),
  )
  return {
    title: purpose === "proof-claim" ? "Prove your claim" : "Prove your block",
    note: claimNote(view, nameOf),
    options: [show, plain("concede", "Concede", null, true, null, () => ({ t: "concede" }))],
  }
}

const blockMenu = (view: G54View, nameOf: (seat: SeatId) => string): WindowMenu => {
  const pending = view.pending
  const blockRole =
    pending === null || pending.role === null ? null : specOf(pending.role).blockRole
  const options: MenuOption[] = []
  if (blockRole !== null) {
    options.push(
      plain("block", `Block with ${specOf(blockRole).name}`, null, true, null, () => ({
        t: "block",
        role: blockRole,
      })),
    )
  }
  options.push(plain("pass", "Pass", null, true, null, () => ({ t: "pass" })))
  return { title: "Block or pass", note: claimNote(view, nameOf), options }
}

const cardChoices = (cards: readonly RoleId[]): readonly MenuCardChoice[] =>
  cards.map((role, index) => ({ index, name: specOf(role).name }))

const revealMenu = (view: G54View): WindowMenu => ({
  title: "Reveal a card",
  note: "Flip one of your face-down cards.",
  options: [
    {
      id: "reveal",
      kind: "card",
      label: "Reveal",
      detail: null,
      enabled: view.myHand.length > 0,
      reason: view.myHand.length > 0 ? null : "No cards to reveal",
      choices: cardChoices(view.myHand),
      action: (index) => ({ t: "reveal", index }),
    },
  ],
})

/**
 * The keep window. The engine accepts exactly `draw.keepSize` indices into
 * `hand + draw.pool`. `keepSize` is the actor's hand size before the draw (every
 * swap opens it that way), which the view carries as `myHand`, so the count is
 * `view.myHand.length`.
 */
const keepMenu = (view: G54View): WindowMenu => {
  const pool = view.myDraw ?? []
  const count = view.myHand.length
  const combined = [...view.myHand, ...pool]
  return {
    title: `Keep ${String(count)} ${count === 1 ? "card" : "cards"}`,
    note: "The rest return to the Court.",
    options: [
      {
        id: "keep",
        kind: "cards",
        label: "Keep",
        detail: null,
        enabled: combined.length >= count,
        reason: combined.length >= count ? null : "Not enough cards to keep",
        count,
        choices: cardChoices(combined),
        action: (indices) => ({ t: "keep", indices }),
      },
    ],
  }
}

/** Crime Boss: the target pays 2 or lets the boss pay 5 to kill it. */
const crimePayMenu = (view: G54View, seat: SeatId, nameOf: (seat: SeatId) => string): WindowMenu => {
  const coins = coinsOf(view, seat)
  const affordable = coins >= CRIME_PAY_COST
  return {
    title: "Pay the Crime Boss",
    note: claimNote(view, nameOf),
    options: [
      plain("pay", `Pay ${String(CRIME_PAY_COST)}`, null, affordable, affordable ? null : shortOf(CRIME_PAY_COST), () => ({
        t: "pay",
      })),
      plain("no", "Refuse", null, true, null, () => ({ t: "no" })),
    ],
  }
}

/** Protestor funding: a third party pays 3 to make the kill land. */
const fundMenu = (view: G54View, seat: SeatId, nameOf: (seat: SeatId) => string): WindowMenu => {
  const coins = coinsOf(view, seat)
  const affordable = coins >= FUND_COST
  return {
    title: "Fund the protest",
    note: claimNote(view, nameOf),
    options: [
      plain("pay", `Fund for ${String(FUND_COST)}`, null, affordable, affordable ? null : shortOf(FUND_COST), () => ({
        t: "pay",
      })),
      plain("no", "Decline", null, true, null, () => ({ t: "no" })),
    ],
  }
}

/** Producer: the partner gives one card from their hand to the exchange. */
const producerGiveMenu = (view: G54View, nameOf: (seat: SeatId) => string): WindowMenu => {
  const has = view.myHand.length > 0
  return {
    title: "Give a card",
    note: claimNote(view, nameOf),
    options: [
      {
        id: "give",
        kind: "card",
        label: "Give",
        detail: null,
        enabled: has,
        reason: has ? null : "No cards to give",
        choices: cardChoices(view.myHand),
        action: (index) => ({ t: "give", index }),
      },
    ],
  }
}

/** Writer: pay 1 for another Court draw, or keep the pool as it stands. */
const writerDrawMenu = (view: G54View, seat: SeatId, nameOf: (seat: SeatId) => string): WindowMenu => {
  const coins = coinsOf(view, seat)
  const canPay = coins >= WRITER_EXTRA_COST && view.courtCount > 0
  const reason =
    coins < WRITER_EXTRA_COST ? shortOf(WRITER_EXTRA_COST) : view.courtCount === 0 ? "The Court is empty" : null
  return {
    title: "Extra draw",
    note: claimNote(view, nameOf),
    options: [
      plain("pay", `Draw another for ${String(WRITER_EXTRA_COST)}`, null, canPay, canPay ? null : reason, () => ({
        t: "pay",
      })),
      plain("no", "Keep", null, true, null, () => ({ t: "no" })),
    ],
  }
}

/** Customs Officer: mark a role in play; a claim of that role then pays the holder 1. */
const customsMarkMenu = (view: G54View, nameOf: (seat: SeatId) => string): WindowMenu => {
  const choices: readonly MenuRoleChoice[] = view.roles.map((role) => ({
    role,
    name: specOf(role).name,
  }))
  return {
    title: "Mark a role",
    note: claimNote(view, nameOf),
    options: [
      {
        id: "mark",
        kind: "role",
        label: "Mark a role",
        detail: null,
        enabled: choices.length > 0,
        reason: choices.length > 0 ? null : "No roles in play",
        choices,
        action: (role) => ({ t: "claim", role, target: null }),
      },
    ],
  }
}

/** Socialist: the target gives a card or, when cardless, pays 1. */
const socialistGiveMenu = (view: G54View, seat: SeatId, nameOf: (seat: SeatId) => string): WindowMenu => {
  const hasCards = view.myHand.length > 0
  const hasCoins = coinsOf(view, seat) > 0
  return {
    title: "Give to the Socialist",
    note: claimNote(view, nameOf),
    options: [
      {
        id: "give",
        kind: "card",
        label: "Give a card",
        detail: null,
        enabled: hasCards,
        reason: hasCards ? null : "No cards to give",
        choices: cardChoices(view.myHand),
        action: (index) => ({ t: "give", index }),
      },
      plain("pay", "Pay 1", null, hasCoins, hasCoins ? null : "No coins to pay", () => ({ t: "pay" })),
    ],
  }
}

/**
 * Socialist swap: give one own card, take one from the collected pile. The engine
 * indexes `ownIndex` into the viewer's hand and `keepIndex` into `hand + pool`, so
 * the pool choices carry their absolute offset past the hand. A seat whose rivals
 * all paid coins faces an empty pool: the engine then treats the swap as a no-op,
 * so the menu still lets the seat give a card and takes it right back.
 */
const socialistKeepMenu = (view: G54View): WindowMenu => {
  const hand = view.myHand
  const pool = view.mySocialist ?? []
  const ownChoices = cardChoices(hand)
  const poolChoices: readonly MenuCardChoice[] = pool.map((role, index) => ({
    index: hand.length + index,
    name: specOf(role).name,
  }))
  const enabled = ownChoices.length > 0
  return {
    title: "Socialist swap",
    note: enabled
      ? poolChoices.length === 0
        ? "No cards were given, so give one and take it back."
        : "Give one card, take one from the pile."
      : "Nothing to swap",
    options: [
      {
        id: "keep",
        kind: "swap",
        label: "Swap",
        detail: null,
        enabled,
        reason: enabled ? null : "No cards in hand",
        ownChoices,
        poolChoices,
        action: (ownIndex, keepIndex) => ({ t: "keep", indices: [ownIndex, keepIndex] }),
      },
    ],
  }
}

/** Capitalist or Plantation Owner mass claim: a rival claims the pending role to collect. */
const massClaimMenu = (view: G54View, nameOf: (seat: SeatId) => string): WindowMenu => {
  const role = view.pending?.role ?? null
  const options: MenuOption[] = []
  if (role !== null) {
    options.push(
      plain("claim", "Claim to collect", specOf(role).name, true, null, () => ({
        t: "claim",
        role,
        target: null,
      })),
    )
  }
  options.push(plain("no", "Pass", null, true, null, () => ({ t: "no" })))
  return { title: "Mass claim", note: claimNote(view, nameOf), options }
}

/** Lawyer: any alive seat may claim the estate of an eliminated seat. */
const lawyerMenu = (view: G54View, nameOf: (seat: SeatId) => string): WindowMenu => ({
  title: "Claim the estate",
  note: claimNote(view, nameOf),
  options: [
    plain("claim", "Claim the estate", null, true, null, () => ({
      t: "claim",
      role: "lawyer",
      target: null,
    })),
    plain("no", "Pass", null, true, null, () => ({ t: "no" })),
  ],
})

/** A reactive role claim after a loss: claim the named reactive role, or decline. */
const reactiveMenu = (
  view: G54View,
  role: RoleId,
  nameOf: (seat: SeatId) => string,
): WindowMenu => ({
  title: `Claim ${specOf(role).name}`,
  note: claimNote(view, nameOf),
  options: [
    plain("claim", `Claim ${specOf(role).name}`, null, true, null, () => ({
      t: "claim",
      role,
      target: null,
    })),
    plain("no", "Decline", null, true, null, () => ({ t: "no" })),
  ],
})

/**
 * Bomb: the holder passes the Bomb to a legal next holder or defuses. Legal next
 * holders mirror `bombPassable`: alive, not resigned, not the current holder, and
 * not any prior holder.
 */
const bombMenu = (view: G54View, seat: SeatId, nameOf: (seat: SeatId) => string): WindowMenu => {
  const bomb = view.tokens.bomb
  // A live `move` means the pass or defuse claim was caught; `resolveBomb` then
  // ignores input and clears the Bomb, so the holder only acknowledges it.
  if (bomb !== null && bomb.move !== null) {
    return {
      title: "The Bomb",
      note: `Held by ${nameOf(bomb.holder)}.`,
      options: [plain("continue", "Continue", null, true, null, () => ({ t: "no" }))],
    }
  }
  const legal =
    bomb === null
      ? []
      : view.players.filter(
          (player) =>
            player.seat !== bomb.holder &&
            !bomb.prior.includes(player.seat) &&
            player.handCount > 0 &&
            !player.resigned,
        )
  const choices: readonly MenuSeatChoice[] = legal.map((player) => ({
    seat: player.seat,
    name: nameOf(player.seat),
    enabled: true,
    reason: null,
  }))
  const holder = bomb?.holder ?? seat
  return {
    title: "The Bomb",
    note: `Held by ${nameOf(holder)}.`,
    options: [
      {
        id: "pass",
        kind: "target",
        label: "Pass the Bomb",
        detail: null,
        enabled: choices.length > 0,
        reason: choices.length > 0 ? null : "No legal next holder",
        face: null,
        choices,
        action: (target) => ({ t: "claim", role: "anarchist", target }),
      },
      plain("defuse", "Defuse", null, true, null, () => ({
        t: "claim",
        role: "anarchist",
        target: null,
      })),
    ],
  }
}

/** Spy's second action reuses the turn menu, plus a Stop that ends the turn. */
const spySecondMenu = (view: G54View, seat: SeatId, nameOf: (seat: SeatId) => string): WindowMenu => {
  const menu = turnMenu(view, seat, nameOf)
  return {
    ...menu,
    title: "Second action",
    options: [...menu.options, plain("stop", "Stop", null, true, null, () => ({ t: "pass" }))],
  }
}

/** Plantation payout is automatic; the active seat only acknowledges it. */
const plantationPayoutMenu = (view: G54View, nameOf: (seat: SeatId) => string): WindowMenu => ({
  title: "Plantation payout",
  note: claimNote(view, nameOf),
  options: [plain("continue", "Continue", null, true, null, () => ({ t: "no" }))],
})

/**
 * The controls the open window offers the viewer, or null when no window is open
 * or the viewer is not owed.
 */
export const menuOf = (
  view: G54View,
  seat: SeatId,
  nameOf: (seat: SeatId) => string,
): WindowMenu | null => {
  if (view.window === null || !view.owedSeats.includes(seat)) return null
  switch (view.window.purpose) {
    case "turn":
      return turnMenu(view, seat, nameOf)
    case "spy-second":
      return spySecondMenu(view, seat, nameOf)
    case "challenge-claim":
    case "challenge-block":
      return challengeMenu(view, seat, view.window.purpose, nameOf)
    case "proof-claim":
    case "proof-block":
      return proofMenu(view, view.window.purpose, nameOf)
    case "block":
      return blockMenu(view, nameOf)
    case "reveal":
      return revealMenu(view)
    case "keep":
      return keepMenu(view)
    case "crime-pay":
      return crimePayMenu(view, seat, nameOf)
    case "protestor-fund":
      return fundMenu(view, seat, nameOf)
    case "producer-give":
      return producerGiveMenu(view, nameOf)
    case "writer-draw":
      return writerDrawMenu(view, seat, nameOf)
    case "customs-mark":
      return customsMarkMenu(view, nameOf)
    case "socialist-give":
      return socialistGiveMenu(view, seat, nameOf)
    case "socialist-keep":
      return socialistKeepMenu(view)
    case "capitalist":
      return massClaimMenu(view, nameOf)
    case "lawyer":
      return lawyerMenu(view, nameOf)
    case "reactive-intellectual":
      return reactiveMenu(view, "intellectual", nameOf)
    case "reactive-missionary":
      return reactiveMenu(view, "missionary", nameOf)
    case "bomb":
      return bombMenu(view, seat, nameOf)
    case "plantation-payout":
      return plantationPayoutMenu(view, nameOf)
  }
}
