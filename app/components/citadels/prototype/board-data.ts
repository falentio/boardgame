import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts"
import { CHARACTER_CATALOG } from "#shared/core/lockstep/games/citadels/index.ts"
import type { DistrictSpec } from "#shared/core/lockstep/games/citadels/districts.ts"
import { BASIC_DISTRICTS, UNIQUE_DISTRICTS } from "#shared/core/lockstep/games/citadels/districts.ts"

export const PROTOTYPE_CHARACTERS = CHARACTER_CATALOG

export const CHARACTER_BY_ID = new Map(CHARACTER_CATALOG.map((spec) => [spec.id as CharacterId, spec]))

export const CHARACTER_BY_RANK = new Map<number, CharacterId[]>()
for (const spec of CHARACTER_CATALOG) {
  const list = CHARACTER_BY_RANK.get(spec.rank) ?? []
  list.push(spec.id)
  CHARACTER_BY_RANK.set(spec.rank, list)
}

export const PROTOTYPE_DISTRICTS: readonly DistrictSpec[] = [
  ...BASIC_DISTRICTS,
  ...UNIQUE_DISTRICTS.slice(0, 20),
]

export const DISTRICT_BY_ID = new Map(PROTOTYPE_DISTRICTS.map((spec) => [spec.id, spec]))

export const DISTRICT_TYPES = ["noble", "religious", "trade", "military", "unique"] as const
