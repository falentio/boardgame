import {
  categoryOf,
  ROLE_CATALOG,
  STARTER_ROLES,
  type RoleCategory,
  type RoleId,
  type RoleSpec,
} from "#shared/core/lockstep/games/g54/roles.ts";

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

const inDraft = (draft: RoleDraft, role: RoleId): boolean =>
  draft.finance === role ||
  draft.communications === role ||
  draft.force === role ||
  draft.special[0] === role ||
  draft.special[1] === role;

const toggleSpecial = (
  special: readonly [RoleId | null, RoleId | null],
  role: RoleId,
): readonly [RoleId | null, RoleId | null] => {
  if (special[0] === role) return [null, special[1]];
  if (special[1] === role) return [special[0], null];
  if (special[0] === null) return [role, special[1]];
  if (special[1] === null) return [special[0], role];
  return special;
};

export const toggleRole = (draft: RoleDraft, role: RoleId): RoleDraft => {
  switch (categoryOf(role)) {
    case "finance":
      return { ...draft, finance: draft.finance === role ? null : role };
    case "communications":
      return { ...draft, communications: draft.communications === role ? null : role };
    case "force":
      return { ...draft, force: draft.force === role ? null : role };
    case "special-interest": {
      const special = toggleSpecial(draft.special, role);
      return special === draft.special ? draft : { ...draft, special };
    }
  }
};

export const completeRoles = (draft: RoleDraft): RoleSet | null => {
  const { finance, communications, force, special } = draft;
  if (finance === null || communications === null || force === null) return null;
  const [first, second] = special;
  if (first === null || second === null) return null;
  return [finance, communications, force, first, second];
};

export const roleOptionState = (
  draft: RoleDraft,
  role: RoleId,
): "selected" | "available" | "blocked" => {
  if (inDraft(draft, role)) return "selected";
  switch (categoryOf(role)) {
    case "finance":
      return draft.finance === null ? "available" : "blocked";
    case "communications":
      return draft.communications === null ? "available" : "blocked";
    case "force":
      return draft.force === null ? "available" : "blocked";
    case "special-interest":
      return draft.special[0] === null || draft.special[1] === null ? "available" : "blocked";
  }
};

export interface RoleGroup {
  category: RoleCategory;
  label: string;
  capacity: number;
  roles: readonly RoleSpec[];
}

const group = (category: RoleCategory, label: string, capacity: number): RoleGroup => ({
  category,
  label,
  capacity,
  roles: ROLE_CATALOG.filter((spec) => spec.category === category),
});

export const ROLE_GROUPS: readonly RoleGroup[] = [
  group("finance", "Finance", 1),
  group("communications", "Communications", 1),
  group("force", "Force", 1),
  group("special-interest", "Special Interest", 2),
];

export const defaultDraft = (): RoleDraft =>
  STARTER_ROLES.reduce<RoleDraft>((draft, role) => toggleRole(draft, role), emptyDraft);
