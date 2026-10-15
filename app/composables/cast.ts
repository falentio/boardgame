import {
  BASE_CAST,
  CHARACTER_CATALOG,
  specOfCharacter,
  type CharacterId,
  type CharacterSpec,
  type Rank,
} from "#shared/core/lockstep/games/citadels/index.ts";

/**
 * One character per rank. The rank key is the invariant: a slot holds at most
 * one id, so two picks can never share a rank and `validateCast`'s
 * one-per-rank rule is unrepresentable to violate. Ranks 1..8 must be filled;
 * rank 9 is optional.
 */
export type CastDraft = { readonly [rank in Rank]: CharacterId | null };

const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const REQUIRED_RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8];

const emptyDraft = (): CastDraft => ({
  1: null,
  2: null,
  3: null,
  4: null,
  5: null,
  6: null,
  7: null,
  8: null,
  9: null,
});

/** Sets the character at its own rank; picking the same character again clears the slot. */
export const pickCharacter = (draft: CastDraft, id: CharacterId): CastDraft => {
  const rank = specOfCharacter(id).rank;
  return { ...draft, [rank]: draft[rank] === id ? null : id };
};

export const defaultCast = (): CastDraft =>
  BASE_CAST.reduce<CastDraft>((draft, id) => pickCharacter(draft, id), emptyDraft());

/** Non-null once ranks 1..8 are filled; rank 9 is optional. Ascending rank order. */
export const completeCast = (draft: CastDraft): readonly CharacterId[] | null => {
  const cast: CharacterId[] = [];
  for (const rank of REQUIRED_RANKS) {
    const id = draft[rank];
    if (id === null) return null;
    cast.push(id);
  }
  const ninth = draft[9];
  if (ninth !== null) cast.push(ninth);
  return cast;
};

export const missingRanks = (draft: CastDraft): readonly Rank[] =>
  REQUIRED_RANKS.filter((rank) => draft[rank] === null);

export const byRank: readonly { rank: Rank; characters: readonly CharacterSpec[] }[] = RANKS.map(
  (rank) => ({ rank, characters: CHARACTER_CATALOG.filter((spec) => spec.rank === rank) }),
);
