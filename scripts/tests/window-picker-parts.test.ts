import { expect, test } from "vitest"
import { ref } from "vue"
import type { G54Action } from "../../shared/core/lockstep/games/g54/index.ts"
import type { CardChoice, WindowMenu } from "../../app/composables/window-menu.ts"
import { usePickerState } from "../../app/components/g54/board/window-picker-parts.ts"

const action = { t: "pass" } as G54Action

const card = (label: string) => ({ label, summary: "x", art: null, accessibleName: label, costLabel: null })

const multi: WindowMenu = {
  title: "Your turn",
  note: null,
  cards: [
    { id: "income", face: { kind: "action", card: card("Income") }, enabled: true, reason: null, group: null, target: null, resolve: () => action },
    { id: "no", face: { kind: "action", card: card("Keep") }, enabled: true, reason: null, group: null, target: null, resolve: () => action },
  ] as readonly CardChoice[],
}

const lone: WindowMenu = {
  title: "Keep 2 cards",
  note: null,
  cards: [
    {
      id: "keep",
      face: { kind: "action", card: card("Keep") },
      enabled: true,
      reason: null,
      group: null,
      target: [
        {
          id: "keep",
          count: 1,
          cards: [
            { id: "card-0", face: { kind: "role", role: "banker" }, enabled: true, reason: null, group: null, index: 0 },
            { id: "card-1", face: { kind: "role", role: "director" }, enabled: true, reason: null, group: null, index: 1 },
          ],
        },
      ],
      resolve: () => action,
    },
  ] as readonly CardChoice[],
}

test("a lone staged card opens its target stage without a select pick", () => {
  const state = usePickerState(ref(lone), ref(false))
  expect(state.skipSelect.value).toBe(true)
  expect(state.card.value?.id).toBe("keep")
  expect(state.groups.value).toHaveLength(1)
})

test("a stale selection does not suppress a lone staged card", () => {
  const menu = ref<WindowMenu>(multi)
  const state = usePickerState(menu, ref(false))
  state.select(menu.value.cards[1]!)
  expect(state.card.value?.id).toBe("no")

  menu.value = lone
  expect(state.skipSelect.value).toBe(true)
  expect(state.card.value?.id).toBe("keep")
  expect(state.groups.value).toHaveLength(1)
})

test("a multi-card menu keeps its select stage", () => {
  const state = usePickerState(ref(multi), ref(false))
  expect(state.skipSelect.value).toBe(false)
  expect(state.card.value).toBeNull()
})
