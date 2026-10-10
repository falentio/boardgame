import type { Ref } from "vue"
import { computed, ref } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import { specOf } from "#shared/core/lockstep/games/g54/roles.ts"
import {
  confirmable,
  type CardChoice,
  type CardFace,
  type StagedCard,
  type TargetCard,
  type TargetGroup,
  type WindowMenu,
} from "@/composables/window-menu.ts"

export const faceName = (face: CardFace): string => {
  if (face.kind === "role") return specOf(face.role).name
  if (face.kind === "action") return face.card.label
  return face.name
}

export const faceSummary = (face: CardFace): string => {
  if (face.kind === "role") return specOf(face.role).summary
  if (face.kind === "action") return face.card.summary
  return "Target"
}

export interface PickerState {
  readonly selectedId: Ref<string | null>
  readonly targetIds: Ref<readonly string[]>
  readonly card: Ref<CardChoice | null>
  readonly groups: Ref<readonly TargetGroup[]>
  readonly skipSelect: Ref<boolean>
  readonly pickedCount: Ref<number>
  readonly required: Ref<number>
  readonly ready: Ref<boolean>
  readonly select: (card: CardChoice) => void
  readonly toggle: (target: TargetCard) => void
  readonly clear: () => void
  readonly build: () => G54Action | null
}

export const usePickerState = (menu: Ref<WindowMenu>, busy: Ref<boolean>): PickerState => {
  const selectedId = ref<string | null>(null)
  const targetIds = ref<readonly string[]>([])

  /** A lone enabled staged card is not a choice: open its target stage, not a one-row select. */
  const loneStaged = computed<StagedCard | null>(() => {
    const only = menu.value.cards.length === 1 ? menu.value.cards[0] : undefined
    return only !== undefined && only.enabled && only.target !== null ? only : null
  })
  const skipSelect = computed(() => loneStaged.value !== null)

  const card = computed<CardChoice | null>(() => {
    const id = selectedId.value ?? loneStaged.value?.id ?? null
    return menu.value.cards.find((candidate) => candidate.id === id) ?? null
  })
  const groups = computed<readonly TargetGroup[]>(() => card.value?.target ?? [])
  const picks = computed<readonly TargetCard[]>(() =>
    groups.value.flatMap((group) => group.cards).filter((c) => targetIds.value.includes(c.id)),
  )
  const pickedCount = computed(() => picks.value.length)
  const required = computed(() => groups.value.reduce((total, group) => total + group.count, 0))
  const ready = computed(
    () => !busy.value && card.value !== null && confirmable(card.value, picks.value),
  )

  const clear = (): void => {
    selectedId.value = null
    targetIds.value = []
  }

  const select = (next: CardChoice): void => {
    if (busy.value || !next.enabled) return
    selectedId.value = next.id
    targetIds.value = []
  }

  const toggle = (target: TargetCard): void => {
    if (busy.value || !target.enabled) return
    if (targetIds.value.includes(target.id)) {
      targetIds.value = targetIds.value.filter((id) => id !== target.id)
      return
    }
    const group = groups.value.find((candidate) => candidate.cards.includes(target))
    if (group === undefined) return
    const chosen = group.cards.filter((c) => targetIds.value.includes(c.id)).length
    if (chosen >= group.count) return
    targetIds.value = [...targetIds.value, target.id]
  }

  const build = (): G54Action | null => {
    const chosen = card.value
    if (chosen === null || !ready.value) return null
    return chosen.target === null ? chosen.resolve() : chosen.resolve(picks.value)
  }

  return {
    selectedId,
    targetIds,
    card,
    groups,
    skipSelect,
    pickedCount,
    required,
    ready,
    select,
    toggle,
    clear,
    build,
  }
}
