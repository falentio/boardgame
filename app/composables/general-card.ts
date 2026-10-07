import type { GeneralActionId } from "#shared/core/lockstep/games/g54/generals.ts"
import { GENERAL_ACTIONS } from "#shared/core/lockstep/games/g54/generals.ts"

export const GENERAL_LABELS: Record<GeneralActionId, string> = {
  income: "Income",
  coup: "Coup",
  bank: "Bank",
  "social-media": "Social Media",
}

/** Placeholder art until a real general-action image exists; one seed per action. */
export const generalActionArt = (action: GeneralActionId): string =>
  `https://picsum.photos/seed/g54-general-${action}/400/400`

/**
 * The data every action card renders. A general action carries its picsum art; a
 * verb card (Pass, Challenge, Keep, …) has no image and no cost.
 */
export interface ActionCardModel {
  readonly id: string
  readonly label: string
  readonly summary: string
  readonly art: string | null
  readonly costLabel: string | null
  readonly accessibleName: string
}

const accessibleNameOf = (label: string, costLabel: string | null, summary: string): string =>
  [label, costLabel, summary].filter((part): part is string => part !== null).join(". ")

export const generalCardModel = (action: GeneralActionId): ActionCardModel => {
  const spec = GENERAL_ACTIONS[action]
  const label = GENERAL_LABELS[action]
  const costLabel = spec.cost > 0 ? `Pay ${String(spec.cost)}` : null
  return {
    id: spec.id,
    label,
    summary: spec.summary,
    art: generalActionArt(action),
    costLabel,
    accessibleName: accessibleNameOf(label, costLabel, spec.summary),
  }
}

/** A verb (Pass, Challenge, Show, Concede, Block, Pay, Refuse, Fund, Continue, Defuse, Stop, Keep, Swap, Reveal, Give, Mark, Claim) as an action card. */
export const verbCardModel = (id: string, label: string, summary: string): ActionCardModel => ({
  id,
  label,
  summary,
  art: null,
  costLabel: null,
  accessibleName: accessibleNameOf(label, null, summary),
})
