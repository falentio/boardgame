import { SecretHitlerError } from "./error.ts";

/** A Policy tile. Distinct from a `Party` even though the two share spelling. */
export type Policy = "liberal" | "fascist";

/** The policy supply for a game: the total Liberal and Fascist tiles in play. */
export type PolicyMix = Readonly<Record<Policy, number>>;

/** 6 Liberal and 11 Fascist Policy tiles [RB p2]. */
export const POLICY_MIX: PolicyMix = { liberal: 6, fascist: 11 };

/** Top of the pile is the LAST element, so a draw pops from the end. */
export type PolicyPile = readonly Policy[];

/** Build one supply's tiles. A variant supplies a smaller Fascist count at some counts. */
export const deckFor = (mix: PolicyMix): PolicyPile => [
  ...Array<Policy>(mix.liberal).fill("liberal"),
  ...Array<Policy>(mix.fascist).fill("fascist"),
];

export const fullDeck = (): PolicyPile => deckFor(POLICY_MIX);

export interface Draw {
  readonly drawn: readonly Policy[];
  readonly rest: PolicyPile;
}

/** Pop `count` tiles from the top. `drawn[0]` is the topmost, so a peek reads top-first. */
export const drawFrom = (pile: PolicyPile, count: number): Draw => {
  const rest = [...pile];
  const drawn: Policy[] = [];
  for (let i = 0; i < count; i += 1) {
    const card = rest.pop();
    if (card === undefined) {
      throw new SecretHitlerError(
        `the policy deck ran out after ${String(i)} of ${String(count)} draws`,
      );
    }
    drawn.push(card);
  }
  return { drawn, rest };
};

export const peekFrom = (pile: PolicyPile, count: number): readonly Policy[] => {
  const top: Policy[] = [];
  for (let i = 0; i < count && i < pile.length; i += 1) top.push(pile[pile.length - 1 - i]!);
  return top;
};

/** The rulebook's reshuffle trigger: fewer than three tiles remain [RB p4, p5]. */
export const RESHUFFLE_BELOW = 3;
export const needsReshuffle = (pile: PolicyPile): boolean => pile.length < RESHUFFLE_BELOW;

export const countPolicies = (pile: PolicyPile): Readonly<Record<Policy, number>> => {
  let liberal = 0;
  let fascist = 0;
  for (const card of pile) {
    if (card === "liberal") liberal += 1;
    else fascist += 1;
  }
  return { liberal, fascist };
};
