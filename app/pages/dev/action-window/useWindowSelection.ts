import { computed, ref, type ComputedRef, type Ref } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import { specOf } from "#shared/core/lockstep/games/g54/roles.ts"
import {
  confirmable,
  type CardChoice,
  type CardFace,
  type TargetCard,
  type TargetGroup,
  type WindowMenu,
} from "@/composables/window-menu.ts"

const faceName = (face: CardFace): string => {
  if (face.kind === "role") return specOf(face.role).name
  if (face.kind === "action") return face.card.label
  return face.name
}

export interface WindowSelection {
  readonly selectedCardId: Ref<string | null>
  readonly selectedCard: ComputedRef<CardChoice | null>
  readonly selectedName: ComputedRef<string | null>
  readonly groups: ComputedRef<readonly TargetGroup[]>
  readonly selectedTargets: ComputedRef<readonly TargetCard[]>
  readonly confirmReady: ComputedRef<boolean>
  readonly confirmLabel: ComputedRef<string>
  readonly isCardDisabled: (card: CardChoice) => boolean
  readonly startsGroup: (index: number) => boolean
  readonly isTargetSelected: (target: TargetCard) => boolean
  readonly select: (card: CardChoice) => void
  readonly toggleTarget: (target: TargetCard) => void
  readonly confirm: () => void
}

export const useWindowSelection = (
  menu: () => WindowMenu,
  busy: () => boolean,
  emit: (action: G54Action) => void,
): WindowSelection => {
  const selectedCardId = ref<string | null>(null)
  const selectedTargetIds = ref<readonly string[]>([])

  const selectedCard = computed<CardChoice | null>(
    () => menu().cards.find((card) => card.id === selectedCardId.value) ?? null,
  )
  const groups = computed<readonly TargetGroup[]>(() => selectedCard.value?.target ?? [])
  const selectedTargets = computed<readonly TargetCard[]>(() =>
    groups.value
      .flatMap((group) => group.cards)
      .filter((card) => selectedTargetIds.value.includes(card.id)),
  )

  const confirmReady = computed(
    () => selectedCard.value !== null && confirmable(selectedCard.value, selectedTargets.value),
  )

  const selectedName = computed<string | null>(() =>
    selectedCard.value === null ? null : faceName(selectedCard.value.face),
  )

  const confirmLabel = computed<string>(() =>
    selectedName.value === null ? "Confirm" : `Confirm ${selectedName.value}`,
  )

  const isCardDisabled = (card: CardChoice): boolean => busy() || !card.enabled

  const startsGroup = (index: number): boolean => {
    const cards = menu().cards
    const previous = cards[index - 1]
    const card = cards[index]
    if (card === undefined || previous === undefined) return false
    return card.group !== previous.group
  }

  const select = (card: CardChoice): void => {
    if (isCardDisabled(card)) return
    selectedCardId.value = card.id
    selectedTargetIds.value = []
  }

  const groupOf = (target: TargetCard): TargetGroup | null =>
    groups.value.find((group) => group.cards.includes(target)) ?? null

  const isTargetSelected = (target: TargetCard): boolean => selectedTargetIds.value.includes(target.id)

  const toggleTarget = (target: TargetCard): void => {
    if (busy() || !target.enabled) return
    if (isTargetSelected(target)) {
      selectedTargetIds.value = selectedTargetIds.value.filter((id) => id !== target.id)
      return
    }
    const group = groupOf(target)
    if (group === null) return
    const chosen = group.cards.filter(isTargetSelected).length
    if (chosen >= group.count) return
    selectedTargetIds.value = [...selectedTargetIds.value, target.id]
  }

  const confirm = (): void => {
    const card = selectedCard.value
    if (card === null || !confirmReady.value) return
    emit(card.target === null ? card.resolve() : card.resolve(selectedTargets.value))
  }

  return {
    selectedCardId,
    selectedCard,
    selectedName,
    groups,
    selectedTargets,
    confirmReady,
    confirmLabel,
    isCardDisabled,
    startsGroup,
    isTargetSelected,
    select,
    toggleTarget,
    confirm,
  }
}
