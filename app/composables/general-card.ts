import type { GeneralActionId } from "#shared/core/lockstep/games/g54/generals.ts"
import { GENERAL_ACTIONS } from "#shared/core/lockstep/games/g54/generals.ts"

const GENERAL_LABELS: Record<GeneralActionId, string> = {
  income: "Income",
  coup: "Coup",
  bank: "Bank",
  "social-media": "Social Media",
}

/** Placeholder art until a real general-action image exists; one seed per action. */
export const generalActionArt = (action: GeneralActionId): string =>
  `https://picsum.photos/seed/g54-general-${action}/400/400`

export interface GeneralCardModel {
  readonly id: GeneralActionId
  readonly label: string
  readonly summary: string
  readonly cost: number
  readonly costLabel: string | null
  readonly art: string
  readonly accessibleName: string
}

export const generalCardModel = (action: GeneralActionId): GeneralCardModel => {
  const spec = GENERAL_ACTIONS[action]
  const label = GENERAL_LABELS[action]
  const costLabel = spec.cost > 0 ? `Pay ${String(spec.cost)}` : null
  const accessibleName = [label, costLabel, spec.summary]
    .filter((part): part is string => part !== null)
    .join(". ")
  return {
    id: spec.id,
    label,
    summary: spec.summary,
    cost: spec.cost,
    costLabel,
    art: generalActionArt(action),
    accessibleName,
  }
}
