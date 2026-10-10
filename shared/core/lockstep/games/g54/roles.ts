import { G54Error } from "./error.ts";

/**
 * The 25-role catalog from `docs/research/coup-rebellion-g54/04..07`. The spec is
 * pure data: cost, target shape, which role blocks the action, and whether the
 * role is reactive (no turn action). Every role's effect lives in `effects.ts`,
 * keyed by `RoleId`; the catalog is complete so any 1/1/1/2 selection builds a
 * deck.
 */

export type RoleCategory = "finance" | "communications" | "force" | "special-interest";

export type RoleId =
  | "banker"
  | "capitalist"
  | "farmer"
  | "speculator"
  | "spy"
  | "director"
  | "newscaster"
  | "producer"
  | "reporter"
  | "writer"
  | "crime-boss"
  | "general"
  | "guerrilla"
  | "judge"
  | "mercenary"
  | "communist"
  | "customs-officer"
  | "foreign-consular"
  | "intellectual"
  | "lawyer"
  | "missionary"
  | "peacekeeper"
  | "politician"
  | "priest"
  | "protestor"
  | "anarchist"
  | "paramilitary"
  | "financier"
  | "plantation-owner"
  | "arms-dealer"
  | "socialist";

export interface RoleSpec {
  readonly id: RoleId;
  readonly name: string;
  readonly category: RoleCategory;
  /** Coins paid when the claim survives its challenge, before any block window. */
  readonly cost: number;
  /** Where the cost lands. Force/Finance attacks pay the Treasury; Judge pays the target. */
  readonly costTo: "treasury" | "target";
  readonly needsTarget: boolean;
  /** The role that blocks this action, or null when the action cannot be blocked. */
  readonly blockRole: RoleId | null;
  /**
   * True for the three roles with no turn action: Intellectual, Lawyer, and
   * Missionary act only through the reactive windows a loss or elimination opens.
   */
  readonly reactive: boolean;
  /** True only for Anarchist: the action needs no held card, so its claim opens no challenge window. */
  readonly holdless?: boolean;
  /** Per-life cost override keyed by the target's face-down card count. Paramilitary: {1:5, 2:3}. */
  readonly costByTargetLives?: Readonly<Record<number, number>>;
  readonly summary: string;
}

export const ROLE_CATALOG: readonly RoleSpec[] = [
  {
    id: "banker",
    name: "Banker",
    category: "finance",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Take 3 coins from the Treasury.",
  },
  {
    id: "capitalist",
    name: "Capitalist",
    category: "finance",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Take 4 coins; each rival may claim Capitalist to take 1 from you.",
  },
  {
    id: "farmer",
    name: "Farmer",
    category: "finance",
    cost: 0,
    costTo: "treasury",
    needsTarget: true,
    blockRole: null,
    reactive: false,
    summary: "Take 3 coins, keep 2, give 1 to a chosen player.",
  },
  {
    id: "speculator",
    name: "Speculator",
    category: "finance",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Double your coins from the Treasury, up to 5 taken.",
  },
  {
    id: "spy",
    name: "Spy",
    category: "finance",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Take 1 coin, then immediately take a second action.",
  },
  {
    id: "director",
    name: "Director",
    category: "communications",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Draw 2 from the Court, then return any 2.",
  },
  {
    id: "newscaster",
    name: "Newscaster",
    category: "communications",
    cost: 1,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Pay 1, draw 3 from the Court, then return any 3.",
  },
  {
    id: "producer",
    name: "Producer",
    category: "communications",
    cost: 0,
    costTo: "treasury",
    needsTarget: true,
    blockRole: "producer",
    reactive: false,
    summary: "Exchange one Court card and one target card, then return one to each.",
  },
  {
    id: "reporter",
    name: "Reporter",
    category: "communications",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Take 1 coin, draw 1 from the Court, then return 1.",
  },
  {
    id: "writer",
    name: "Writer",
    category: "communications",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Draw 1 free, pay 1 per extra draw, then return the same number.",
  },
  {
    id: "crime-boss",
    name: "Crime Boss",
    category: "force",
    cost: 5,
    costTo: "treasury",
    needsTarget: true,
    blockRole: null,
    reactive: false,
    summary: "Target pays you 2 to end it, else pay 5 and the target loses 1 influence.",
  },
  {
    id: "general",
    name: "General",
    category: "force",
    cost: 5,
    costTo: "treasury",
    needsTarget: false,
    blockRole: "general",
    reactive: false,
    summary: "Pay 5; every other player loses 1 influence unless they block with General.",
  },
  {
    id: "guerrilla",
    name: "Guerrilla",
    category: "force",
    cost: 4,
    costTo: "treasury",
    needsTarget: true,
    blockRole: "guerrilla",
    reactive: false,
    summary: "Pay 4; the target loses 1 influence unless blocked by Guerrilla.",
  },
  {
    id: "judge",
    name: "Judge",
    category: "force",
    cost: 3,
    costTo: "target",
    needsTarget: true,
    blockRole: "judge",
    reactive: false,
    summary: "Give 3 to the target; the target loses 1 influence unless blocked by Judge.",
  },
  {
    id: "mercenary",
    name: "Mercenary",
    category: "force",
    cost: 3,
    costTo: "treasury",
    needsTarget: true,
    blockRole: "mercenary",
    reactive: false,
    summary:
      "Pay 3; place a Disappear token on the target to lose 1 influence after its next turn.",
  },
  {
    id: "communist",
    name: "Communist",
    category: "special-interest",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: "communist",
    reactive: false,
    summary: "Steal up to 3 from the wealthiest player and give them to the poorest.",
  },
  {
    id: "customs-officer",
    name: "Customs Officer",
    category: "special-interest",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Take the Tax tokens; mark a role that costs 1 to claim.",
  },
  {
    id: "foreign-consular",
    name: "Foreign Consular",
    category: "special-interest",
    cost: 0,
    costTo: "treasury",
    needsTarget: true,
    blockRole: null,
    reactive: false,
    summary: "Take a Treaty token and ally with another player.",
  },
  {
    id: "intellectual",
    name: "Intellectual",
    category: "special-interest",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: true,
    summary: "Reactive: after losing influence, take 5 coins from the Treasury.",
  },
  {
    id: "lawyer",
    name: "Lawyer",
    category: "special-interest",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: true,
    summary: "Reactive: when a player is eliminated, claim to take their coins.",
  },
  {
    id: "missionary",
    name: "Missionary",
    category: "special-interest",
    cost: 4,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: true,
    summary: "Reactive: after losing influence (not to Coup), pay 4 coins to take 1 Court card.",
  },
  {
    id: "peacekeeper",
    name: "Peacekeeper",
    category: "special-interest",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Take 1 coin and the Peacekeeping token; you cannot be targeted except by Coup.",
  },
  {
    id: "politician",
    name: "Politician",
    category: "special-interest",
    cost: 0,
    costTo: "treasury",
    needsTarget: true,
    blockRole: "politician",
    reactive: false,
    summary: "Steal up to 2 coins from a target unless blocked by Politician.",
  },
  {
    id: "priest",
    name: "Priest",
    category: "special-interest",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: "priest",
    reactive: false,
    summary: "All other players give you 1 coin if able; each may block with Priest.",
  },
  {
    id: "protestor",
    name: "Protestor",
    category: "special-interest",
    cost: 2,
    costTo: "treasury",
    needsTarget: true,
    blockRole: "protestor",
    reactive: false,
    summary: "Pay 2 and target; another player may pay 3 to make the target lose 1 influence.",
  },
  {
    id: "anarchist",
    name: "Anarchist",
    category: "force",
    cost: 3,
    costTo: "treasury",
    needsTarget: true,
    blockRole: null,
    reactive: false,
    holdless: true,
    summary: "Pay 3, hand the Bomb to a target; each holder passes or defuses, else loses 1 influence.",
  },
  {
    id: "paramilitary",
    name: "Paramilitary",
    category: "force",
    cost: 3,
    costTo: "treasury",
    needsTarget: true,
    blockRole: "paramilitary",
    reactive: false,
    costByTargetLives: { 1: 5, 2: 3 },
    summary: "Pay 3 (2 lives) or 5 (1 life); the target loses 1 influence unless blocked by Paramilitary.",
  },
  {
    id: "financier",
    name: "Financier",
    category: "finance",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Take every coin from the Bank pile. While in play, Bank replaces Income.",
  },
  {
    id: "plantation-owner",
    name: "Plantation Owner",
    category: "finance",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Take 1; each rival may claim; every surviving claimant then takes 1 per survivor.",
  },
  {
    id: "arms-dealer",
    name: "Arms Dealer",
    category: "special-interest",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: null,
    reactive: false,
    summary: "Name a role; reveal 2 deck cards; gain 4 if either matches, then reshuffle both back.",
  },
  {
    id: "socialist",
    name: "Socialist",
    category: "special-interest",
    cost: 0,
    costTo: "treasury",
    needsTarget: false,
    blockRole: "socialist",
    reactive: false,
    summary: "Each rival gives 1 coin or 1 card; the active then swaps 1 own card for 1 of the pile.",
  },
];

export const STARTER_ROLES: readonly RoleId[] = [
  "banker",
  "director",
  "guerrilla",
  "politician",
  "peacekeeper",
];

const BY_ID: ReadonlyMap<RoleId, RoleSpec> = new Map(ROLE_CATALOG.map((spec) => [spec.id, spec]));

export const ROLE_IDS: readonly RoleId[] = ROLE_CATALOG.map((spec) => spec.id);

export const isRoleId = (value: string): value is RoleId => BY_ID.has(value as RoleId);

export const asRoleId = (value: string): RoleId => {
  if (!isRoleId(value)) throw new G54Error(`unknown role: ${value}`);
  return value;
};

export const specOf = (role: RoleId): RoleSpec => {
  const spec = BY_ID.get(role);
  if (spec === undefined) throw new G54Error(`unknown role: ${role}`);
  return spec;
};

export const categoryOf = (role: RoleId): RoleCategory => specOf(role).category;

/** True only for Anarchist: the action needs no held card, so its claim opens no challenge window. */
export const isHoldless = (spec: RoleSpec): boolean => spec.holdless === true;

/** The cost of a claim given the target's remaining lives, falling back to the static cost. */
export const claimCost = (spec: RoleSpec, targetLives: number): number =>
  spec.costByTargetLives?.[targetLives] ?? spec.cost;

export const missionarySaveCost = specOf("missionary").cost;

export const categoryCounts = (roles: readonly RoleId[]): ReadonlyMap<RoleCategory, number> => {
  const counts = new Map<RoleCategory, number>();
  for (const role of roles) {
    const category = categoryOf(role);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return counts;
};
