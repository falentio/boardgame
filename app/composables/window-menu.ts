import type { SeatId } from "#shared/rooms/ids.ts"
import type { G54Action, G54View, WindowView } from "#shared/core/lockstep/games/g54/index.ts"
import { specOf } from "#shared/core/lockstep/games/g54/roles.ts"
import type { GeneralActionId } from "#shared/core/lockstep/games/g54/generals.ts"
import { GENERAL_ACTIONS } from "#shared/core/lockstep/games/g54/generals.ts"
import { COUP_COST, FORCED_COUP_COINS } from "#shared/core/lockstep/games/g54/windows.ts"

/** One selectable target for a `target` option. The name is resolved here so the
 *  component never needs the identity map. */
export interface MenuSeatChoice {
  readonly seat: SeatId
  readonly name: string
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
  readonly purpose: WindowView["purpose"]
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

const turnMenu = (view: G54View, seat: SeatId, nameOf: (seat: SeatId) => string): WindowMenu => {
  const coins = view.players.find((player) => player.seat === seat)?.coins ?? 0
  const forcedCoup = coins >= FORCED_COUP_COINS
  // The view does not project `isInPlay`, so exact per-seat targetability
  // (Peacekeeping, a Treaty ally, a seat mid-sub-turn) is not recoverable here.
  // Offer every rival that still holds a card and let the engine coerce the rare
  // illegal target.
  const choices: readonly MenuSeatChoice[] = view.players
    .filter((player) => player.seat !== seat && player.handCount > 0)
    .map((player) => ({ seat: player.seat, name: nameOf(player.seat) }))
  const hasTarget = choices.length > 0

  const coupOption: MenuOption = {
    id: "coup",
    kind: "target",
    label: GENERAL_LABELS.coup,
    detail: GENERAL_ACTIONS.coup.summary,
    enabled: coins >= COUP_COST && hasTarget,
    reason: !hasTarget ? NO_TARGET : coins < COUP_COST ? shortOf(COUP_COST) : null,
    choices,
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

  const claims = view.roles
    .map(specOf)
    .filter((spec) => !spec.reactive)
    .map((spec): MenuOption => {
      const affordable = coins >= spec.cost
      const enabled = !forcedCoup && affordable && (!spec.needsTarget || hasTarget)
      const reason = forcedCoup
        ? FORCED_COUP_REASON
        : !affordable
          ? shortOf(spec.cost)
          : spec.needsTarget && !hasTarget
            ? NO_TARGET
            : null
      const label = `Claim ${spec.name}`
      const detail = spec.cost > 0 ? `Costs ${String(spec.cost)}` : null
      if (spec.needsTarget) {
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
      return {
        id: `claim-${spec.id}`,
        kind: "plain",
        label,
        detail,
        enabled,
        reason,
        action: () => ({ t: "claim", role: spec.id, target: null }),
      }
    })

  return {
    purpose: "turn",
    title: "Your turn",
    note: forcedCoup ? FORCED_COUP_REASON : null,
    options: [...generals, ...claims],
  }
}

/**
 * The controls the open window offers the viewer, or null when no window is open,
 * the viewer is not owed, or the purpose has no handler yet. Only `turn` is
 * handled; Units 3–8 add a case each.
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
    default:
      return null
  }
}
