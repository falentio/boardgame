import { computed, ref, type ComputedRef, type Ref } from "vue"
import type { G54Action } from "#shared/core/lockstep/games/g54/index.ts"
import type { MenuOption, MenuSeatChoice, WindowMenu } from "@/composables/window-menu.ts"

/** A turn option carries a card face: a plain general or a target claim. */
export type TurnFaceOption = Extract<MenuOption, { kind: "plain" | "target" }>

export interface TurnCards {
  readonly general: ComputedRef<readonly TurnFaceOption[]>
  readonly roles: ComputedRef<readonly TurnFaceOption[]>
  readonly openId: Ref<string | null>
  readonly choose: (option: TurnFaceOption) => void
  readonly pick: (option: Extract<MenuOption, { kind: "target" }>, choice: MenuSeatChoice) => void
}

const hasFace = (option: MenuOption): option is TurnFaceOption =>
  (option.kind === "plain" || option.kind === "target") && option.face !== null

/**
 * The shared behavior every turn variant uses: split the turn menu into general
 * actions and role claims, then build the action a card emits. The variants
 * differ only in how they lay the two lists out.
 */
export const useTurnCards = (
  menu: () => WindowMenu,
  busy: () => boolean | undefined,
  emit: (action: G54Action) => void,
): TurnCards => {
  const faced = computed(() => menu().options.filter(hasFace))
  const general = computed(() => faced.value.filter((option) => option.face?.kind === "general"))
  const roles = computed(() => faced.value.filter((option) => option.face?.kind === "role"))
  const openId = ref<string | null>(null)

  const isDisabled = (option: TurnFaceOption): boolean => busy() === true || !option.enabled

  const choose = (option: TurnFaceOption): void => {
    if (isDisabled(option)) return
    if (option.kind === "target") {
      openId.value = openId.value === option.id ? null : option.id
      return
    }
    emit(option.action())
  }

  const pick = (
    option: Extract<MenuOption, { kind: "target" }>,
    choice: MenuSeatChoice,
  ): void => {
    if (isDisabled(option) || !choice.enabled) return
    openId.value = null
    emit(option.action(choice.seat))
  }

  return { general, roles, openId, choose, pick }
}
