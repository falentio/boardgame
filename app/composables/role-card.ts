import type { RoleCategory, RoleId, RoleSpec } from "#shared/core/lockstep/games/g54/roles.ts"
import { specOf } from "#shared/core/lockstep/games/g54/roles.ts"

export interface RoleCategoryMeta {
  readonly label: string
  readonly art: string
  readonly accent: string
}

const CATEGORY_META: Readonly<Record<RoleCategory, RoleCategoryMeta>> = {
  finance: {
    label: "Finance",
    art: "/g54/role-categories/finance.webp",
    accent: "var(--category-finance)",
  },
  communications: {
    label: "Communications",
    art: "/g54/role-categories/communication.webp",
    accent: "var(--category-communications)",
  },
  force: {
    label: "Force",
    art: "/g54/role-categories/force.webp",
    accent: "var(--category-force)",
  },
  "special-interest": {
    label: "Special Interest",
    art: "/g54/token/special-interest.webp",
    accent: "var(--category-special-interest)",
  },
}

const categoryMeta = (category: RoleCategory): RoleCategoryMeta => CATEGORY_META[category]

export interface RoleCardModel {
  readonly id: RoleId
  readonly name: string
  readonly category: RoleCategory
  readonly categoryLabel: string
  readonly summary: string
  readonly art: string
  readonly categoryArt: string
  readonly accent: string
  readonly cost: string | null
  readonly block: string | null
  readonly blockName: string | null
  readonly accessibleName: string
}

const costLabel = (spec: RoleSpec): string | null => {
  if (spec.costByTargetLives !== undefined) {
    const byLives = Object.entries(spec.costByTargetLives).sort(([a], [b]) => Number(b) - Number(a))
    return `Pay ${byLives.map(([, value]) => value).join(" / ")}`
  }
  if (spec.cost === 0) return null
  return spec.costTo === "target" ? `Give ${spec.cost}` : `Pay ${spec.cost}`
}

const blockNameOf = (spec: RoleSpec): string | null =>
  spec.blockRole === null ? null : specOf(spec.blockRole).name

const accessibleNameOf = (
  spec: RoleSpec,
  categoryLabel: string,
  cost: string | null,
  block: string | null,
): string =>
  [`${spec.name}, ${categoryLabel} role.`, cost === null ? null : `${cost}.`, block === null ? null : `${block}.`]
    .filter((part): part is string => part !== null)
    .join(" ")

export const roleCardModel = (role: RoleId): RoleCardModel => {
  const spec = specOf(role)
  const meta = categoryMeta(spec.category)
  const cost = costLabel(spec)
  const blockName = blockNameOf(spec)
  const block = blockName === null ? null : `Blocked by ${blockName}`
  return {
    id: spec.id,
    name: spec.name,
    category: spec.category,
    categoryLabel: meta.label,
    summary: spec.summary,
    art: `/roles/${spec.id}.webp`,
    categoryArt: meta.art,
    accent: meta.accent,
    cost,
    block,
    blockName,
    accessibleName: accessibleNameOf(spec, meta.label, cost, block),
  }
}
