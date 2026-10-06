import { expect, test } from "vitest";
import { roleCardModel } from "../role-card.ts";
import { ROLE_IDS } from "#shared/core/lockstep/games/g54/roles.ts";

test("cost label distinguishes Treasury pay, target give, and per-life pay", () => {
  expect(roleCardModel("banker").cost).toBeNull();
  expect(roleCardModel("guerrilla").cost).toBe("Pay 4");
  expect(roleCardModel("judge").cost).toBe("Give 3");
  expect(roleCardModel("paramilitary").cost).toBe("Pay 3 / 5");
});

test("block label names the blocking role, null when unblockable", () => {
  expect(roleCardModel("guerrilla").block).toBe("Blocked by Guerrilla");
  expect(roleCardModel("guerrilla").blockName).toBe("Guerrilla");
  expect(roleCardModel("banker").block).toBeNull();
  expect(roleCardModel("banker").blockName).toBeNull();
});

test("special-interest art comes from the token folder", () => {
  expect(roleCardModel("intellectual").categoryArt).toBe("/g54/token/special-interest.webp");
  expect(roleCardModel("banker").categoryArt).toBe("/g54/role-categories/finance.webp");
  expect(roleCardModel("director").categoryArt).toBe("/g54/role-categories/communication.webp");
});

test("accessible name carries name, category, cost, and block", () => {
  expect(roleCardModel("banker").accessibleName).toBe("Banker, Finance role.");
  expect(roleCardModel("guerrilla").accessibleName).toBe("Guerrilla, Force role. Pay 4. Blocked by Guerrilla.");
});

test("every role resolves a complete card model", () => {
  for (const role of ROLE_IDS) {
    const model = roleCardModel(role);
    expect(model.name.length).toBeGreaterThan(0);
    expect(model.summary.length).toBeGreaterThan(0);
    expect(model.art).toBe(`/roles/${role}.webp`);
    expect(model.accent.startsWith("var(--category-")).toBe(true);
  }
});
