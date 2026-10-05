import { expect, test } from "vitest";
import { validateRoles } from "../../../shared/core/lockstep/games/g54/setup.ts";
import {
  completeRoles,
  defaultDraft,
  emptyDraft,
  ROLE_GROUPS,
  roleOptionState,
  toggleRole,
  type RoleDraft,
} from "../roles.ts";

test("toggleRole replaces a single-slot category and clears on re-pick", () => {
  const first = toggleRole(emptyDraft, "banker");
  expect(first.finance).toBe("banker");

  const replaced = toggleRole(first, "capitalist");
  expect(replaced.finance).toBe("capitalist");

  const cleared = toggleRole(replaced, "capitalist");
  expect(cleared.finance).toBeNull();
});

test("toggleRole never accumulates within a single-slot category", () => {
  const draft = toggleRole(toggleRole(emptyDraft, "banker"), "spy");
  expect(draft.finance).toBe("spy");
  expect([draft.finance, draft.communications, draft.force]).toEqual(["spy", null, null]);
});

test("toggleRole fills special slots, removes on re-pick, and caps at two", () => {
  const one = toggleRole(emptyDraft, "politician");
  expect(one.special).toEqual(["politician", null]);

  const two = toggleRole(one, "peacekeeper");
  expect(two.special).toEqual(["politician", "peacekeeper"]);

  const removed = toggleRole(two, "politician");
  expect(removed.special).toEqual([null, "peacekeeper"]);

  const full = toggleRole(two, "communist");
  expect(full).toBe(two);
  expect(full.special).toEqual(["politician", "peacekeeper"]);
});

test("toggleRole never allows the same role twice", () => {
  const draft = toggleRole(toggleRole(toggleRole(emptyDraft, "banker"), "politician"), "banker");
  const picked = [draft.finance, draft.communications, draft.force, draft.special[0], draft.special[1]];
  const present = picked.filter((role) => role !== null);
  expect(new Set(present).size).toBe(present.length);
});

test("completeRoles is null until every slot is filled", () => {
  expect(completeRoles(emptyDraft)).toBeNull();

  let draft: RoleDraft = toggleRole(emptyDraft, "banker");
  expect(completeRoles(draft)).toBeNull();

  draft = toggleRole(draft, "director");
  expect(completeRoles(draft)).toBeNull();

  draft = toggleRole(draft, "guerrilla");
  expect(completeRoles(draft)).toBeNull();

  draft = toggleRole(draft, "politician");
  expect(completeRoles(draft)).toBeNull();

  draft = toggleRole(draft, "peacekeeper");
  expect(completeRoles(draft)).toEqual(["banker", "director", "guerrilla", "politician", "peacekeeper"]);
});

test("roleOptionState reports selected, available, and blocked", () => {
  expect(roleOptionState(emptyDraft, "banker")).toBe("available");

  const withFinance = toggleRole(emptyDraft, "banker");
  expect(roleOptionState(withFinance, "banker")).toBe("selected");
  expect(roleOptionState(withFinance, "capitalist")).toBe("blocked");

  const withSpecial = toggleRole(toggleRole(emptyDraft, "politician"), "peacekeeper");
  expect(roleOptionState(withSpecial, "politician")).toBe("selected");
  expect(roleOptionState(withSpecial, "communist")).toBe("blocked");

  const oneSpecial = toggleRole(emptyDraft, "politician");
  expect(roleOptionState(oneSpecial, "communist")).toBe("available");
});

test("ROLE_GROUPS partitions the catalog with the 1/1/1/2 capacities", () => {
  expect(ROLE_GROUPS.map((entry) => entry.category)).toEqual([
    "finance",
    "communications",
    "force",
    "special-interest",
  ]);
  expect(ROLE_GROUPS.map((entry) => entry.capacity)).toEqual([1, 1, 1, 2]);
  expect(ROLE_GROUPS.map((entry) => entry.label)).toEqual([
    "Finance",
    "Communications",
    "Force",
    "Special Interest",
  ]);
  for (const entry of ROLE_GROUPS) {
    expect(entry.roles.every((role) => role.category === entry.category)).toBe(true);
  }
  expect(ROLE_GROUPS.reduce((total, entry) => total + entry.roles.length, 0)).toBe(25);
});

test("completeRoles(defaultDraft()) passes the shared validateRoles", () => {
  const roles = completeRoles(defaultDraft());
  expect(roles).not.toBeNull();
  if (roles === null) throw new Error("expected a complete set");
  expect(() => validateRoles(roles)).not.toThrow();
});

test("partial drafts are null and the category caps make over-filling impossible", () => {
  const partials: RoleDraft[] = [
    emptyDraft,
    toggleRole(emptyDraft, "banker"),
    toggleRole(toggleRole(emptyDraft, "banker"), "director"),
    toggleRole(toggleRole(toggleRole(emptyDraft, "banker"), "director"), "guerrilla"),
    toggleRole(
      toggleRole(toggleRole(toggleRole(emptyDraft, "banker"), "director"), "guerrilla"),
      "politician",
    ),
  ];
  for (const draft of partials) {
    expect(completeRoles(draft)).toBeNull();
  }

  const catalog = ROLE_GROUPS.flatMap((entry) => entry.roles.map((role) => role.id));
  const attempted = catalog.reduce<RoleDraft>((draft, role) => toggleRole(draft, role), emptyDraft);
  expect(attempted.special).toHaveLength(2);
  expect(attempted.special[0]).not.toBeNull();
  expect(attempted.special[1]).not.toBeNull();
  const roles = completeRoles(attempted);
  expect(roles).not.toBeNull();
  if (roles === null) throw new Error("expected a complete set");
  expect(new Set(roles).size).toBe(5);
  expect(() => validateRoles(roles)).not.toThrow();
});
