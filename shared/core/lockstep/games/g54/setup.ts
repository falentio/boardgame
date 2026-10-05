import type { Random, Roster } from "../../index.ts";
import { G54Error } from "./error.ts";
import { categoryCounts, categoryOf, type RoleId } from "./roles.ts";
import type { G54Player, G54State } from "./state.ts";

export interface G54Setup {
  /** Exactly 5 roles: 1 Finance, 1 Communications, 1 Force, 2 Special Interest. */
  readonly roles: readonly RoleId[];
  /**
   * Social Media was drafted: it becomes an extra general action for the whole
   * game. It is not a role; the extra Communications draw happened in the draft.
   */
  readonly socialMedia?: boolean;
}

/** Three copies of each chosen role; the retail 15-card influence deck. */
export const DECK_PER_ROLE = 3;
export const DEAL_SIZE = 2;
export const STARTING_COINS = 2;
/** The retail box's coin supply; players take `STARTING_COINS` and the rest is the Treasury. */
export const COIN_SUPPLY = 50;

export const validateRoles = (roles: readonly RoleId[]): void => {
  if (roles.length !== 5) {
    throw new G54Error(`g54 needs exactly 5 roles, got ${String(roles.length)}`);
  }
  if (new Set(roles).size !== roles.length) {
    throw new G54Error("g54 roles must be distinct");
  }
  const counts = categoryCounts(roles);
  const finance = counts.get("finance") ?? 0;
  const communications = counts.get("communications") ?? 0;
  const force = counts.get("force") ?? 0;
  const special = counts.get("special-interest") ?? 0;
  if (finance !== 1 || communications !== 1 || force !== 1 || special !== 2) {
    throw new G54Error(
      `g54 needs 1 Finance + 1 Communications + 1 Force + 2 Special Interest, got ${String(finance)}/${String(communications)}/${String(force)}/${String(special)}`,
    );
  }
};

/** Three copies of each role, then one shuffle. The deck order is hidden state. */
export const buildDeck = (roles: readonly RoleId[], rng: Random): readonly RoleId[] => {
  const cards = roles.flatMap((role) => Array.from({ length: DECK_PER_ROLE }, () => role));
  return rng.shuffle(cards);
};

export const genesisState = (setup: G54Setup, roster: Roster, rng: Random): G54State => {
  validateRoles(setup.roles);
  const active = roster.order[0];
  if (active === undefined) throw new G54Error("g54 needs at least one seat");
  const deck = buildDeck(setup.roles, rng);
  const needed = DEAL_SIZE * roster.order.length;
  if (deck.length < needed) {
    throw new G54Error(
      `g54 needs ${String(needed)} cards to deal ${String(DEAL_SIZE)} to each of ${String(roster.order.length)} seats, but the deck has ${String(deck.length)}`,
    );
  }
  const players = roster.order.map((seat, index): G54Player => ({
    seat,
    coins: STARTING_COINS,
    hand: deck.slice(index * DEAL_SIZE, (index + 1) * DEAL_SIZE),
    revealed: [],
  }));
  return {
    roles: [...setup.roles].sort((a, b) => categoryOrder(a) - categoryOrder(b)),
    players,
    court: deck.slice(needed),
    treasury: COIN_SUPPLY - STARTING_COINS * roster.order.length,
    active,
    turn: 0,
    steps: [],
    pending: null,
    extras: [],
    draw: null,
    peacekeeping: null,
    treaty: [],
    tax: null,
    disappear: [],
    bank: 0,
    socialMedia: setup.socialMedia === true,
    bomb: null,
    socialist: null,
    plantation: null,
    arms: null,
    resigned: [],
  };
};

/** Canonical, category-ordered role list so two peers encode the same `roles`. */
const CATEGORY_RANK = { finance: 0, communications: 1, force: 2, "special-interest": 3 } as const;
const categoryOrder = (role: RoleId): number => CATEGORY_RANK[categoryOf(role)];
