import { expect, test } from "vitest"
import { GENERAL_ACTIONS, type GeneralActionId } from "#shared/core/lockstep/games/g54/generals.ts"
import { generalActionArt, generalCardModel } from "../general-card.ts"

const ACTIONS: readonly GeneralActionId[] = ["income", "coup", "bank", "social-media"]

test("label names each general action", () => {
  expect(generalCardModel("income").label).toBe("Income")
  expect(generalCardModel("coup").label).toBe("Coup")
  expect(generalCardModel("bank").label).toBe("Bank")
  expect(generalCardModel("social-media").label).toBe("Social Media")
})

test("summary comes from the general action registry", () => {
  for (const action of ACTIONS) {
    expect(generalCardModel(action).summary).toBe(GENERAL_ACTIONS[action].summary)
  }
})

test("costLabel is Pay 7 for a nonzero cost, null otherwise", () => {
  expect(generalCardModel("coup").cost).toBe(7)
  expect(generalCardModel("coup").costLabel).toBe("Pay 7")
  for (const action of ["income", "bank", "social-media"] as const) {
    expect(generalCardModel(action).cost).toBe(0)
    expect(generalCardModel(action).costLabel).toBeNull()
  }
})

test("art is a stable picsum seed per action", () => {
  for (const action of ACTIONS) {
    expect(generalCardModel(action).art).toBe(
      `https://picsum.photos/seed/g54-general-${action}/400/400`,
    )
  }
  expect(generalActionArt("coup")).toBe("https://picsum.photos/seed/g54-general-coup/400/400")
})

test("accessible name carries the label, the cost, and the summary", () => {
  expect(generalCardModel("coup").accessibleName).toBe(
    `Coup. Pay 7. ${GENERAL_ACTIONS.coup.summary}`,
  )
  expect(generalCardModel("income").accessibleName).toBe(
    `Income. ${GENERAL_ACTIONS.income.summary}`,
  )
})

test("every general action resolves a complete card model", () => {
  for (const action of ACTIONS) {
    const model = generalCardModel(action)
    expect(model.id).toBe(action)
    expect(model.label.length).toBeGreaterThan(0)
    expect(model.summary.length).toBeGreaterThan(0)
    expect(model.accessibleName.length).toBeGreaterThan(0)
  }
})
