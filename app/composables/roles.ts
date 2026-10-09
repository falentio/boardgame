import {
  categoryOf,
  ROLE_CATALOG,
  STARTER_ROLES,
  type RoleCategory,
  type RoleId,
  type RoleSpec,
} from "#shared/core/lockstep/games/g54/roles.ts";

/**
 * The role draft domain. A draft is five slots to fill: Finance,
 * Communications, Force, and two Special Interest. Every role stays pickable at
 * all times; picking one into a filled slot replaces what was there.
 */

export interface RoleDraft {
  finance: RoleId | null;
  communications: RoleId | null;
  force: RoleId | null;
  special: readonly [RoleId | null, RoleId | null];
}

export type RoleSet = readonly [RoleId, RoleId, RoleId, RoleId, RoleId];

export const emptyDraft: RoleDraft = {
  finance: null,
  communications: null,
  force: null,
  special: [null, null],
};

export type SlotId = "finance" | "communications" | "force" | "special-1" | "special-2";

export interface PickSlot {
  readonly id: SlotId;
  readonly category: RoleCategory;
  readonly label: string;
  readonly role: RoleId | null;
}

const SLOT_META: readonly Omit<PickSlot, "role">[] = [
  { id: "finance", category: "finance", label: "Finance" },
  { id: "communications", category: "communications", label: "Communications" },
  { id: "force", category: "force", label: "Force" },
  { id: "special-1", category: "special-interest", label: "Special Interest" },
  { id: "special-2", category: "special-interest", label: "Special Interest" },
];

const roleAtSlot = (draft: RoleDraft, id: SlotId): RoleId | null => {
  switch (id) {
    case "finance":
      return draft.finance;
    case "communications":
      return draft.communications;
    case "force":
      return draft.force;
    case "special-1":
      return draft.special[0];
    case "special-2":
      return draft.special[1];
  }
};

export const slotsOf = (draft: RoleDraft): readonly PickSlot[] =>
  SLOT_META.map((meta) => ({ ...meta, role: roleAtSlot(draft, meta.id) }));

export const filledCount = (draft: RoleDraft): number =>
  slotsOf(draft).filter((slot) => slot.role !== null).length;

export const isPicked = (draft: RoleDraft, role: RoleId): boolean =>
  slotsOf(draft).some((slot) => slot.role === role);

export const missingLabels = (draft: RoleDraft): readonly string[] => {
  const counts = new Map<string, number>();
  for (const slot of slotsOf(draft)) {
    if (slot.role !== null) continue;
    counts.set(slot.label, (counts.get(slot.label) ?? 0) + 1);
  }
  return [...counts].map(([label, count]) => `${count} ${label}`);
};

const clear = (draft: RoleDraft, role: RoleId): RoleDraft => {
  if (draft.finance === role) return { ...draft, finance: null };
  if (draft.communications === role) return { ...draft, communications: null };
  if (draft.force === role) return { ...draft, force: null };
  if (draft.special[0] === role) return { ...draft, special: [null, draft.special[1]] };
  if (draft.special[1] === role) return { ...draft, special: [draft.special[0], null] };
  return draft;
};

const assign = (draft: RoleDraft, role: RoleId): RoleDraft => {
  switch (categoryOf(role)) {
    case "finance":
      return { ...draft, finance: role };
    case "communications":
      return { ...draft, communications: role };
    case "force":
      return { ...draft, force: role };
    case "special-interest": {
      const [first, second] = draft.special;
      if (first === null) {
        if (second === null) return { ...draft, special: [role, null] };
        return { ...draft, special: [second, role] };
      }
      if (second === null) return { ...draft, special: [first, role] };
      return { ...draft, special: [second, role] };
    }
  }
};

export const pickRole = (draft: RoleDraft, role: RoleId): RoleDraft =>
  isPicked(draft, role) ? clear(draft, role) : assign(draft, role);

export const completeRoles = (draft: RoleDraft): RoleSet | null => {
  const { finance, communications, force, special } = draft;
  if (finance === null || communications === null || force === null) return null;
  const [first, second] = special;
  if (first === null || second === null) return null;
  return [finance, communications, force, first, second];
};

export interface PickGroup {
  readonly key: string;
  readonly label: string;
  readonly roles: readonly RoleSpec[];
}

const rolesIn = (category: RoleCategory): readonly RoleSpec[] =>
  ROLE_CATALOG.filter((spec) => spec.category === category).sort((a, b) => a.name.localeCompare(b.name));

export const mergedGroups: readonly PickGroup[] = [
  { key: "finance", label: "Finance", roles: rolesIn("finance") },
  { key: "communications", label: "Communications", roles: rolesIn("communications") },
  { key: "force", label: "Force", roles: rolesIn("force") },
  { key: "special", label: "Special Interest", roles: rolesIn("special-interest") },
];

export const defaultDraft = (): RoleDraft =>
  STARTER_ROLES.reduce<RoleDraft>((draft, role) => pickRole(draft, role), emptyDraft);
