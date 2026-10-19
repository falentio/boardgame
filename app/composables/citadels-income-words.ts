import type { IncomeGrant } from "#shared/core/lockstep/games/citadels/characters.ts";

/**
 * What an income grant is called on the board. Two forms per kind, because the
 * table prints a bare rate ("gold or card / trade") while the picker prints a noun
 * after the numeral ("1 gold or a card per religious district"). Keyed by the
 * engine's own `IncomeGrant` union, so a grant kind added there fails this
 * declaration instead of rendering nothing.
 */
export const INCOME_GRANT_WORDS = {
  gold: { bare: "gold", withArticle: "gold" },
  cards: { bare: "card", withArticle: "a card" },
  "gold-or-cards": { bare: "gold or card", withArticle: "gold or a card" },
} as const satisfies Readonly<
  Record<IncomeGrant["kind"], { readonly bare: string; readonly withArticle: string }>
>;
