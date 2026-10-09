import type { SeatId } from "#shared/rooms/ids.ts"
import type { G54Action, G54View, PlayerView } from "#shared/core/lockstep/games/g54/index.ts"
import { claimCost, specOf, type RoleId } from "#shared/core/lockstep/games/g54/roles.ts"
import type { GeneralActionId } from "#shared/core/lockstep/games/g54/generals.ts"
import { COUP_COST, FORCED_COUP_COINS } from "#shared/core/lockstep/games/g54/windows.ts"
import { generalCardModel, verbCardModel, type ActionCardModel } from "./general-card.ts"

/** The name and avatar a player card renders; the descriptor has no board access. */
export interface SeatIdentity {
  readonly name: string
  readonly image: string | null
}

/** What a card renders: a role, an action model, or a seat. */
export type CardFace =
  | { readonly kind: "role"; readonly role: RoleId }
  | { readonly kind: "action"; readonly card: ActionCardModel }
  | {
      readonly kind: "player"
      readonly seat: SeatId
      readonly name: string
      readonly image: string | null
    }

interface CardBase {
  readonly id: string
  readonly face: CardFace
  readonly enabled: boolean
  readonly reason: string | null
  /** Cards sharing a group are drawn together; the strip rules a divider where it changes. */
  readonly group: string | null
}

/** A card in the target stage. `index` is the engine's card position for a hand, pool, or pile slot. */
export interface TargetCard extends CardBase {
  readonly index: number | null
}

/** One row of target cards the viewer fills to `count`. */
export interface TargetGroup {
  readonly id: string
  readonly count: number
  readonly cards: readonly TargetCard[]
}

/** A select card with no target stage; its action needs nothing more. */
export interface DirectCard extends CardBase {
  readonly target: null
  readonly resolve: () => G54Action
}

/** A select card whose target stage must be filled before `resolve` runs. */
export interface StagedCard extends CardBase {
  readonly target: readonly TargetGroup[]
  readonly resolve: (picks: readonly TargetCard[]) => G54Action
}

export type CardChoice = DirectCard | StagedCard

/** The cards the open window offers, or null when the viewer owes nothing here. */
export interface WindowMenu {
  readonly title: string
  readonly note: string | null
  readonly cards: readonly CardChoice[]
}

const FORCED_COUP_REASON = `At ${String(FORCED_COUP_COINS)} coins Coup is forced`
const NO_TARGET = "No legal target"
const GENERAL_GROUP = "General actions"
const CLAIM_GROUP = "Claim a role"

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

const roleFace = (role: RoleId): CardFace => ({ kind: "role", role })
const actionFace = (card: ActionCardModel): CardFace => ({ kind: "action", card })

const verb = (label: string, summary: string): CardFace =>
  actionFace(verbCardModel(label, summary))

const direct = (
  id: string,
  face: CardFace,
  resolve: () => G54Action,
  enabled = true,
  reason: string | null = null,
  group: string | null = null,
): DirectCard => ({ id, face, enabled, reason, group, target: null, resolve })

const staged = (
  id: string,
  face: CardFace,
  target: readonly TargetGroup[],
  resolve: (picks: readonly TargetCard[]) => G54Action,
  enabled = true,
  reason: string | null = null,
  group: string | null = null,
): StagedCard => ({ id, face, enabled, reason, group, target, resolve })

const playerTarget = (
  player: PlayerView,
  identityOf: (seat: SeatId) => SeatIdentity,
  enabled: boolean,
  reason: string | null,
): TargetCard => {
  const identity = identityOf(player.seat)
  return {
    id: `seat-${player.seat}`,
    face: { kind: "player", seat: player.seat, name: identity.name, image: identity.image },
    enabled,
    reason,
    group: null,
    index: null,
  }
}

const roleTarget = (role: RoleId, index: number, id: string): TargetCard => ({
  id,
  face: roleFace(role),
  enabled: true,
  reason: null,
  group: null,
  index,
})

const seatOf = (pick: TargetCard): SeatId => {
  if (pick.face.kind !== "player") throw new Error(`card ${pick.id} is not a player`)
  return pick.face.seat
}

const indicesOf = (picks: readonly TargetCard[]): readonly number[] =>
  picks.map((pick) => pick.index).filter((index): index is number => index !== null)

/** True when `card` and `picks` satisfy the confirm gate. Reads counts and flags only. */
export const confirmable = (card: CardChoice, picks: readonly TargetCard[]): boolean => {
  if (!card.enabled) return false
  if (card.target === null) return true
  return card.target.every(
    (group) =>
      group.cards.filter((target) => target.enabled && picks.includes(target)).length ===
      group.count,
  )
}

/**
 * The one action a window forces when it offers no real choice: exactly one card,
 * it is enabled, and it needs no target picks. The challenge windows owe the
 * claimant (or blocker) a report so the frame can seal, but the engine skips them
 * as challengers, so their only legal card is Pass. A forced action is not a
 * choice, so the caller reports it without rendering a one-card picker.
 */
export const forcedAction = (menu: WindowMenu): G54Action | null => {
  if (menu.cards.length !== 1) return null
  const card = menu.cards[0]
  if (card === undefined || !card.enabled) return null
  if (card.target === null) return card.resolve()
  if (card.target.every((group) => group.count === 0)) return card.resolve([])
  return null
}

const targetChoices = (
  rivals: readonly PlayerView[],
  identityOf: (seat: SeatId) => SeatIdentity,
  costOf: (player: PlayerView) => number,
  coins: number,
): readonly TargetCard[] =>
  rivals.map((player) => {
    const cost = costOf(player)
    const affordable = coins >= cost
    return playerTarget(player, identityOf, affordable, affordable ? null : shortOf(cost))
  })

const PLAIN_GENERALS: Record<Exclude<GeneralActionId, "coup">, () => G54Action> = {
  income: () => ({ t: "income" }),
  bank: () => ({ t: "bank" }),
  "social-media": () => ({ t: "social-media" }),
}

const turnMenu = (
  view: G54View,
  seat: SeatId,
  identityOf: (seat: SeatId) => SeatIdentity,
): WindowMenu => {
  const coins = coinsOf(view, seat)
  const forcedCoup = coins >= FORCED_COUP_COINS

  const coupChoices = targetChoices(
    rivalTargets(view, seat, false),
    identityOf,
    () => COUP_COST,
    coins,
  )
  const coupEnabled = coins >= COUP_COST && coupChoices.some((choice) => choice.enabled)
  const coupCard = staged(
    "coup",
    actionFace(generalCardModel("coup")),
    [{ id: "target", count: 1, cards: coupChoices }],
    (picks) => ({ t: "coup", target: seatOf(picks[0]!) }),
    coupEnabled,
    coupChoices.length === 0 ? NO_TARGET : coupEnabled ? null : shortOf(COUP_COST),
    GENERAL_GROUP,
  )

  const generals = view.generalActions.map((id): CardChoice => {
    if (id === "coup") return coupCard
    return direct(
      id,
      actionFace(generalCardModel(id)),
      PLAIN_GENERALS[id],
      !forcedCoup,
      forcedCoup ? FORCED_COUP_REASON : null,
      GENERAL_GROUP,
    )
  })

  const rivals = rivalTargets(view, seat, true)

  const claims = view.roles
    .map(specOf)
    .filter((spec) => !spec.reactive)
    .map((spec): CardChoice => {
      const face = roleFace(spec.id)
      if (spec.needsTarget) {
        const choices = targetChoices(
          rivals,
          identityOf,
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
        return staged(
          `claim-${spec.id}`,
          face,
          [{ id: "target", count: 1, cards: choices }],
          (picks) => ({ t: "claim", role: spec.id, target: seatOf(picks[0]!) }),
          enabled,
          reason,
          CLAIM_GROUP,
        )
      }
      const cost = claimCost(spec, 0)
      const affordable = coins >= cost
      return direct(
        `claim-${spec.id}`,
        face,
        () => ({ t: "claim", role: spec.id, target: null }),
        !forcedCoup && affordable,
        forcedCoup ? FORCED_COUP_REASON : affordable ? null : shortOf(cost),
        CLAIM_GROUP,
      )
    })

  return {
    title: "Your turn",
    note: forcedCoup ? FORCED_COUP_REASON : null,
    cards: [...generals, ...claims],
  }
}

const claimNote = (view: G54View, identityOf: (seat: SeatId) => SeatIdentity): string | null => {
  const pending = view.pending
  if (pending === null) return null
  const nameOf = (seat: SeatId): string => identityOf(seat).name
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
  identityOf: (seat: SeatId) => SeatIdentity,
): WindowMenu => {
  const pending = view.pending
  // The engine skips the claimant and the blocker when it picks a challenger, so
  // their Challenge is ignored; offer them Pass alone.
  const mayChallenge =
    pending !== null &&
    (purpose === "challenge-claim" ? seat !== pending.claimant : seat !== pending.blocker)
  const cards: CardChoice[] = []
  if (mayChallenge) {
    cards.push(
      direct("challenge", verb("Challenge", "Call the claim a bluff."), () => ({
        t: "challenge",
      })),
    )
  }
  cards.push(direct("pass", verb("Pass", "Take no action."), () => ({ t: "pass" })))
  return {
    title: purpose === "challenge-claim" ? "Challenge the claim" : "Challenge the block",
    note: claimNote(view, identityOf),
    cards,
  }
}

/** The card the viewer must hold to show: the claimed role, or the claim's block role. */
const proofSpec = (view: G54View, purpose: "proof-claim" | "proof-block") => {
  const pending = view.pending
  if (pending === null || pending.role === null) return null
  if (purpose === "proof-claim") return specOf(pending.role)
  const blockRole = specOf(pending.role).blockRole
  return blockRole === null ? null : specOf(blockRole)
}

const proofMenu = (
  view: G54View,
  purpose: "proof-claim" | "proof-block",
  identityOf: (seat: SeatId) => SeatIdentity,
): WindowMenu => {
  const spec = proofSpec(view, purpose)
  const holds = spec !== null && view.myHand.includes(spec.id)
  const show = direct(
    "show",
    verb("Show", spec === null ? "Prove the claimed card." : spec.name),
    () => ({ t: "show" }),
    holds,
    holds || spec === null ? null : `You do not hold ${spec.name}`,
  )
  return {
    title: purpose === "proof-claim" ? "Prove your claim" : "Prove your block",
    note: claimNote(view, identityOf),
    cards: [show, direct("concede", verb("Concede", "Give up the claim."), () => ({ t: "concede" }))],
  }
}

const blockMenu = (view: G54View, identityOf: (seat: SeatId) => SeatIdentity): WindowMenu => {
  const pending = view.pending
  const blockRole = pending === null || pending.role === null ? null : specOf(pending.role).blockRole
  const cards: CardChoice[] = []
  if (blockRole !== null) {
    cards.push(
      direct("block", roleFace(blockRole), () => ({ t: "block", role: blockRole })),
    )
  }
  cards.push(direct("pass", verb("Pass", "Take no action."), () => ({ t: "pass" })))
  return { title: "Block or pass", note: claimNote(view, identityOf), cards }
}

const revealMenu = (view: G54View): WindowMenu => ({
  title: "Reveal a card",
  note: "Flip one of your face-down cards.",
  cards: view.myHand.map((role, index) =>
    direct(`reveal-${String(index)}`, roleFace(role), () => ({ t: "reveal", index })),
  ),
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
  const cards = combined.map((role, index) => roleTarget(role, index, `card-${String(index)}`))
  return {
    title: `Keep ${String(count)} ${count === 1 ? "card" : "cards"}`,
    note: "The rest return to the Court.",
    cards: [
      staged(
        "keep",
        verb("Keep", "Return the rest to the Court."),
        [{ id: "keep", count, cards }],
        (picks) => ({ t: "keep", indices: indicesOf(picks) }),
        combined.length >= count,
        combined.length >= count ? null : "Not enough cards to keep",
      ),
    ],
  }
}

/** Crime Boss: the target pays 2 or lets the boss pay 5 to kill it. */
const crimePayMenu = (
  view: G54View,
  seat: SeatId,
  identityOf: (seat: SeatId) => SeatIdentity,
): WindowMenu => {
  const affordable = coinsOf(view, seat) >= CRIME_PAY_COST
  return {
    title: "Pay the Crime Boss",
    note: claimNote(view, identityOf),
    cards: [
      direct(
        "pay",
        verb(`Pay ${String(CRIME_PAY_COST)}`, "Pay the Crime Boss."),
        () => ({ t: "pay" }),
        affordable,
        affordable ? null : shortOf(CRIME_PAY_COST),
      ),
      direct("no", verb("Refuse", "Let the Crime Boss act."), () => ({ t: "no" })),
    ],
  }
}

/** Protestor funding: a third party pays 3 to make the kill land. */
const fundMenu = (
  view: G54View,
  seat: SeatId,
  identityOf: (seat: SeatId) => SeatIdentity,
): WindowMenu => {
  const affordable = coinsOf(view, seat) >= FUND_COST
  return {
    title: "Fund the protest",
    note: claimNote(view, identityOf),
    cards: [
      direct(
        "pay",
        verb("Fund", `Pay ${String(FUND_COST)} to make the kill land.`),
        () => ({ t: "pay" }),
        affordable,
        affordable ? null : shortOf(FUND_COST),
      ),
      direct("no", verb("Decline", "Take no action."), () => ({ t: "no" })),
    ],
  }
}

/** Producer: the partner gives one card from their hand to the exchange. */
const producerGiveMenu = (view: G54View, identityOf: (seat: SeatId) => SeatIdentity): WindowMenu => ({
  title: "Give a card",
  note: claimNote(view, identityOf),
  cards: view.myHand.map((role, index) =>
    direct(`give-${String(index)}`, roleFace(role), () => ({ t: "give", index })),
  ),
})

/** Writer: pay 1 for another Court draw, or keep the pool as it stands. */
const writerDrawMenu = (
  view: G54View,
  seat: SeatId,
  identityOf: (seat: SeatId) => SeatIdentity,
): WindowMenu => {
  const coins = coinsOf(view, seat)
  const canPay = coins >= WRITER_EXTRA_COST && view.courtCount > 0
  const reason =
    coins < WRITER_EXTRA_COST
      ? shortOf(WRITER_EXTRA_COST)
      : view.courtCount === 0
        ? "The Court is empty"
        : null
  return {
    title: "Extra draw",
    note: claimNote(view, identityOf),
    cards: [
      direct(
        "pay",
        verb("Draw another", `Pay ${String(WRITER_EXTRA_COST)} for another Court draw.`),
        () => ({ t: "pay" }),
        canPay,
        canPay ? null : reason,
      ),
      direct("no", verb("Keep", "Keep the pool as it stands."), () => ({ t: "no" })),
    ],
  }
}

/** Customs Officer: mark a role in play; a claim of that role then pays the holder 1. */
const customsMarkMenu = (view: G54View, identityOf: (seat: SeatId) => SeatIdentity): WindowMenu => ({
  title: "Mark a role",
  note: claimNote(view, identityOf),
  cards: view.roles.map((role) =>
    direct(`mark-${role}`, roleFace(role), () => ({ t: "claim", role, target: null })),
  ),
})

/** Socialist: the target gives a card or, when cardless, pays 1. */
const socialistGiveMenu = (
  view: G54View,
  seat: SeatId,
  identityOf: (seat: SeatId) => SeatIdentity,
): WindowMenu => {
  const hasCoins = coinsOf(view, seat) > 0
  const giveCards = view.myHand.map((role, index) =>
    direct(`give-${String(index)}`, roleFace(role), () => ({ t: "give", index })),
  )
  return {
    title: "Give to the Socialist",
    note: claimNote(view, identityOf),
    cards: [
      ...giveCards,
      direct(
        "pay",
        verb("Pay 1", "Pay the Socialist instead."),
        () => ({ t: "pay" }),
        hasCoins,
        hasCoins ? null : "No coins to pay",
      ),
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
  const poolCards = pool.map((role, index) =>
    roleTarget(role, hand.length + index, `pool-${String(index)}`),
  )
  const count = poolCards.length > 0 ? 1 : 0
  const enabled = hand.length > 0
  return {
    title: "Socialist swap",
    note: enabled
      ? poolCards.length === 0
        ? "No cards were given, so give one and take it back."
        : "Give one card, take one from the pile."
      : "Nothing to swap",
    cards: hand.map((role, index) =>
      staged(
        `keep-${String(index)}`,
        roleFace(role),
        [{ id: "take", count, cards: poolCards }],
        (picks) => ({ t: "keep", indices: [index, picks[0]?.index ?? index] }),
        enabled,
        enabled ? null : "No cards in hand",
      ),
    ),
  }
}

/** Capitalist or Plantation Owner mass claim: a rival claims the pending role to collect. */
const massClaimMenu = (view: G54View, identityOf: (seat: SeatId) => SeatIdentity): WindowMenu => {
  const role = view.pending?.role ?? null
  const cards: CardChoice[] = []
  if (role !== null) {
    cards.push(direct("claim", roleFace(role), () => ({ t: "claim", role, target: null })))
  }
  cards.push(direct("no", verb("Pass", "Take no action."), () => ({ t: "no" })))
  return { title: "Mass claim", note: claimNote(view, identityOf), cards }
}

/** Lawyer: any alive seat may claim the estate of an eliminated seat. */
const lawyerMenu = (view: G54View, identityOf: (seat: SeatId) => SeatIdentity): WindowMenu => ({
  title: "Claim the estate",
  note: claimNote(view, identityOf),
  cards: [
    direct("claim", roleFace("lawyer"), () => ({ t: "claim", role: "lawyer", target: null })),
    direct("no", verb("Pass", "Take no action."), () => ({ t: "no" })),
  ],
})

/** A reactive role claim after a loss: claim the named reactive role, or decline. */
const reactiveMenu = (
  view: G54View,
  role: RoleId,
  identityOf: (seat: SeatId) => SeatIdentity,
): WindowMenu => ({
  title: `Claim ${specOf(role).name}`,
  note: claimNote(view, identityOf),
  cards: [
    direct("claim", roleFace(role), () => ({ t: "claim", role, target: null })),
    direct("no", verb("Decline", "Take no action."), () => ({ t: "no" })),
  ],
})

/**
 * Bomb: the holder passes the Bomb to a legal next holder or defuses. Legal next
 * holders mirror `bombPassable`: alive, not resigned, not the current holder, and
 * not any prior holder.
 */
const bombMenu = (
  view: G54View,
  seat: SeatId,
  identityOf: (seat: SeatId) => SeatIdentity,
): WindowMenu => {
  const bomb = view.tokens.bomb
  const nameOf = (target: SeatId): string => identityOf(target).name
  // A live `move` means the pass or defuse claim was caught; `resolveBomb` then
  // ignores input and clears the Bomb, so the holder only acknowledges it.
  if (bomb !== null && bomb.move !== null) {
    return {
      title: "The Bomb",
      note: `Held by ${nameOf(bomb.holder)}.`,
      cards: [direct("continue", verb("Continue", "Acknowledge."), () => ({ t: "no" }))],
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
  const choices = legal.map((player) => playerTarget(player, identityOf, true, null))
  const holder = bomb?.holder ?? seat
  return {
    title: "The Bomb",
    note: `Held by ${nameOf(holder)}.`,
    cards: [
      staged(
        "pass",
        verb("Pass the Bomb", "Hand the Bomb to another seat."),
        [{ id: "target", count: 1, cards: choices }],
        (picks) => ({ t: "claim", role: "anarchist", target: seatOf(picks[0]!) }),
        choices.length > 0,
        choices.length > 0 ? null : "No legal next holder",
      ),
      direct(
        "defuse",
        verb("Defuse", "Disarm the Bomb."),
        () => ({ t: "claim", role: "anarchist", target: null }),
      ),
    ],
  }
}

const ONCE_PER_TURN = "Once per turn"

/**
 * Spy's second action reuses the turn menu with Spy muted, plus a Stop. Spy stays
 * in the list rather than dropping out, so the reason is visible instead of the
 * card reading as missing.
 */
const spySecondMenu = (
  view: G54View,
  seat: SeatId,
  identityOf: (seat: SeatId) => SeatIdentity,
): WindowMenu => {
  const menu = turnMenu(view, seat, identityOf)
  const cards = menu.cards.map((card): CardChoice =>
    card.id === "claim-spy" ? { ...card, enabled: false, reason: ONCE_PER_TURN } : card,
  )
  return {
    ...menu,
    title: "Second action",
    cards: [...cards, direct("stop", verb("Stop", "End your turn."), () => ({ t: "pass" }))],
  }
}

/** Plantation payout is automatic; the active seat only acknowledges it. */
const plantationPayoutMenu = (view: G54View, identityOf: (seat: SeatId) => SeatIdentity): WindowMenu => ({
  title: "Plantation payout",
  note: claimNote(view, identityOf),
  cards: [direct("continue", verb("Continue", "Acknowledge."), () => ({ t: "no" }))],
})

/**
 * The cards the open window offers the viewer, or null when no window is open or
 * the viewer is not owed.
 */
export const menuOf = (
  view: G54View,
  seat: SeatId,
  identityOf: (seat: SeatId) => SeatIdentity,
): WindowMenu | null => {
  if (view.window === null || !view.owedSeats.includes(seat)) return null
  switch (view.window.purpose) {
    case "turn":
      return turnMenu(view, seat, identityOf)
    case "spy-second":
      return spySecondMenu(view, seat, identityOf)
    case "challenge-claim":
    case "challenge-block":
      return challengeMenu(view, seat, view.window.purpose, identityOf)
    case "proof-claim":
    case "proof-block":
      return proofMenu(view, view.window.purpose, identityOf)
    case "block":
      return blockMenu(view, identityOf)
    case "reveal":
      return revealMenu(view)
    case "keep":
      return keepMenu(view)
    case "crime-pay":
      return crimePayMenu(view, seat, identityOf)
    case "protestor-fund":
      return fundMenu(view, seat, identityOf)
    case "producer-give":
      return producerGiveMenu(view, identityOf)
    case "writer-draw":
      return writerDrawMenu(view, seat, identityOf)
    case "customs-mark":
      return customsMarkMenu(view, identityOf)
    case "socialist-give":
      return socialistGiveMenu(view, seat, identityOf)
    case "socialist-keep":
      return socialistKeepMenu(view)
    case "capitalist":
      return massClaimMenu(view, identityOf)
    case "lawyer":
      return lawyerMenu(view, identityOf)
    case "reactive-intellectual":
      return reactiveMenu(view, "intellectual", identityOf)
    case "reactive-missionary":
      return reactiveMenu(view, "missionary", identityOf)
    case "bomb":
      return bombMenu(view, seat, identityOf)
    case "plantation-payout":
      return plantationPayoutMenu(view, identityOf)
  }
}
