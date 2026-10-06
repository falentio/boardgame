import type { SeatId } from "#shared/rooms/ids.ts"
import type { G54Action, G54View, PlayerView } from "#shared/core/lockstep/games/g54/index.ts"
import { claimCost, specOf, type RoleSpec } from "#shared/core/lockstep/games/g54/roles.ts"
import type { GeneralActionId } from "#shared/core/lockstep/games/g54/generals.ts"
import { GENERAL_ACTIONS } from "#shared/core/lockstep/games/g54/generals.ts"
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
      readonly choices: readonly MenuSeatChoice[]
      readonly action: (seat: SeatId) => G54Action
    }

/** The controls for the open window, or null when the viewer owes nothing here. */
export interface WindowMenu {
  readonly title: string
  readonly note: string | null
  readonly options: readonly MenuOption[]
}

const GENERAL_LABELS: Record<GeneralActionId, string> = {
  income: "Income",
  coup: "Coup",
  bank: "Bank",
  "social-media": "Social Media",
}

const PLAIN_GENERALS: Record<Exclude<GeneralActionId, "coup">, () => G54Action> = {
  income: () => ({ t: "income" }),
  bank: () => ({ t: "bank" }),
  "social-media": () => ({ t: "social-media" }),
}

const FORCED_COUP_REASON = `At ${String(FORCED_COUP_COINS)} coins Coup is forced`
const NO_TARGET = "No legal target"

const shortOf = (cost: number): string => `Needs ${String(cost)} coins`

/** Both seats of a two-seat Treaty spare each other, mirroring `isAlly` in the engine. */
const isTreatyAlly = (treaty: readonly SeatId[], claimant: SeatId, seat: SeatId): boolean =>
  treaty.length === 2 && treaty.includes(claimant) && treaty.includes(seat)

/**
 * The rivals the engine will accept as a target. `peacekeeperImmune` mirrors the
 * engine split: a general target spares the Peacekeeper, a Coup does not.
 *
 * Three target rules stay in the engine: a seat transiently cardless mid-swap is
 * not told apart from an eliminated one (the view carries only `handCount`),
 * Communist picks its own victim, and the Anarchist prior-holder set is not
 * projected. Each is coerced there rather than offered here.
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
): MenuOption => ({ id, kind: "plain", label, detail, enabled, reason, action })

const turnMenu = (view: G54View, seat: SeatId, nameOf: (seat: SeatId) => string): WindowMenu => {
  const coins = view.players.find((player) => player.seat === seat)?.coins ?? 0
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
  purpose: "challenge-claim" | "challenge-block",
  nameOf: (seat: SeatId) => string,
): WindowMenu => ({
  title: purpose === "challenge-claim" ? "Challenge the claim" : "Challenge the block",
  note: claimNote(view, nameOf),
  options: [
    plain("challenge", "Challenge", null, true, null, () => ({ t: "challenge" })),
    plain("pass", "Pass", null, true, null, () => ({ t: "pass" })),
  ],
})

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

/**
 * The controls the open window offers the viewer, or null when no window is open,
 * the viewer is not owed, or the purpose has no handler yet. Units 6–8 add a case
 * each.
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
    case "challenge-claim":
    case "challenge-block":
      return challengeMenu(view, view.window.purpose, nameOf)
    case "proof-claim":
    case "proof-block":
      return proofMenu(view, view.window.purpose, nameOf)
    case "block":
      return blockMenu(view, nameOf)
    default:
      return null
  }
}
