import { expect, test } from "vitest";
import { validateRoles } from "../../../shared/core/lockstep/games/g54/setup.ts";
import {
  completeRoles,
  defaultDraft,
  emptyDraft,
  filledCount,
  isPicked,
  mergedGroups,
  missingLabels,
  pickRole,
  slotsOf,
  type RoleDraft,
} from "../roles.ts";

test("pickRole replaces a single-slot category and clears on re-pick", () => {
  const first = pickRole(emptyDraft, "banker");
  expect(first.finance).toBe("banker");

  const replaced = pickRole(first, "capitalist");
  expect(replaced.finance).toBe("capitalist");
  expect(filledCount(replaced)).toBe(1);

  const cleared = pickRole(replaced, "capitalist");
  expect(cleared.finance).toBeNull();
});

test("pickRole never accumulates within a single-slot category", () => {
  const draft = pickRole(pickRole(emptyDraft, "banker"), "spy");
  expect(draft.finance).toBe("spy");
  expect([draft.finance, draft.communications, draft.force]).toEqual(["spy", null, null]);
});

test("pickRole fills both special slots, clears on re-pick, and replaces when full", () => {
  const one = pickRole(emptyDraft, "politician");
  expect(one.special).toEqual(["politician", null]);

  const two = pickRole(one, "peacekeeper");
  expect(two.special).toEqual(["politician", "peacekeeper"]);

  const removed = pickRole(two, "politician");
  expect(removed.special).toEqual([null, "peacekeeper"]);

  const replaced = pickRole(two, "communist");
  expect(replaced.special).toEqual(["communist", "peacekeeper"]);
  expect(filledCount(replaced)).toBe(2);
});

test("pickRole evicts the oldest special across consecutive replacements", () => {
  const two = pickRole(pickRole(emptyDraft, "politician"), "peacekeeper");
  const third = pickRole(two, "communist");
  expect(third.special).toEqual(["peacekeeper", "communist"]);
  const fourth = pickRole(third, "arms-dealer");
  expect(fourth.special).toEqual(["communist", "arms-dealer"]);
  expect(filledCount(fourth)).toBe(2);
});

test("pickRole never allows the same role twice", () => {
  const draft = pickRole(pickRole(pickRole(emptyDraft, "banker"), "politician"), "banker");
  const picked = [draft.finance, draft.communications, draft.force, draft.special[0], draft.special[1]];
  const present = picked.filter((role) => role !== null);
  expect(new Set(present).size).toBe(present.length);
});

test("every role stays pickable: a full draft replaces in one step", () => {
  const full = defaultDraft();
  expect(filledCount(full)).toBe(5);

  const swapped = pickRole(full, "capitalist");
  expect(swapped.finance).toBe("capitalist");
  expect(isPicked(swapped, "capitalist")).toBe(true);
  expect(isPicked(swapped, "banker")).toBe(false);
  expect(filledCount(swapped)).toBe(5);
});

test("completeRoles is null until every slot is filled", () => {
  expect(completeRoles(emptyDraft)).toBeNull();

  let draft: RoleDraft = pickRole(emptyDraft, "banker");
  expect(completeRoles(draft)).toBeNull();

  draft = pickRole(draft, "director");
  expect(completeRoles(draft)).toBeNull();

  draft = pickRole(draft, "guerrilla");
  expect(completeRoles(draft)).toBeNull();

  draft = pickRole(draft, "politician");
  expect(completeRoles(draft)).toBeNull();

  draft = pickRole(draft, "peacekeeper");
  expect(completeRoles(draft)).toEqual(["banker", "director", "guerrilla", "politician", "peacekeeper"]);
});

test("slotsOf reports five slots with the two specials distinct", () => {
  const slots = slotsOf(defaultDraft());
  expect(slots.map((slot) => slot.id)).toEqual([
    "finance",
    "communications",
    "force",
    "special-1",
    "special-2",
  ]);
  expect(slots[3]?.category).toBe("special-interest");
  expect(slots[4]?.category).toBe("special-interest");
});

test("missingLabels names each unfilled slot by category and count", () => {
  expect(missingLabels(emptyDraft)).toEqual([
    "1 Finance",
    "1 Communications",
    "1 Force",
    "2 Special Interest",
  ]);
  expect(missingLabels(defaultDraft())).toEqual([]);

  const oneSpecial = pickRole(defaultDraft(), "politician");
  expect(missingLabels(oneSpecial)).toEqual(["1 Special Interest"]);
});

test("mergedGroups partitions the whole catalog into four categories", () => {
  expect(mergedGroups.map((group) => group.key)).toEqual(["finance", "communications", "force", "special"]);
  const catalog = mergedGroups.flatMap((group) => group.roles.map((role) => role.id));
  expect(catalog.length).toBe(31);
  expect(new Set(catalog).size).toBe(catalog.length);
});

test("completeRoles(defaultDraft()) passes the shared validateRoles", () => {
  const roles = completeRoles(defaultDraft());
  expect(roles).not.toBeNull();
  if (roles === null) throw new Error("expected a complete set");
  expect(() => validateRoles(roles)).not.toThrow();
});

test("a partial draft stays null and picking the whole catalog still yields five distinct roles", () => {
  const partials: RoleDraft[] = [
    emptyDraft,
    pickRole(emptyDraft, "banker"),
    pickRole(pickRole(emptyDraft, "banker"), "director"),
    pickRole(pickRole(pickRole(emptyDraft, "banker"), "director"), "guerrilla"),
    pickRole(pickRole(pickRole(pickRole(emptyDraft, "banker"), "director"), "guerrilla"), "politician"),
  ];
  for (const draft of partials) {
    expect(completeRoles(draft)).toBeNull();
  }

  const catalog = mergedGroups.flatMap((group) => group.roles.map((role) => role.id));
  const attempted = catalog.reduce<RoleDraft>((draft, role) => pickRole(draft, role), emptyDraft);
  const roles = completeRoles(attempted);
  expect(roles).not.toBeNull();
  if (roles === null) throw new Error("expected a complete set");
  expect(new Set(roles).size).toBe(5);
  expect(() => validateRoles(roles)).not.toThrow();
});
