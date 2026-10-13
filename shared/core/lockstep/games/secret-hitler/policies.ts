import { SecretHitlerError } from "./error.ts";

/** A Policy tile. Distinct from a `Party` even though the two share spelling. */
export type Policy = "liberal" | "fascist";

/** 6 Liberal and 11 Fascist Policy tiles [RB p2]. */
export const POLICY_MIX: Readonly<Record<Policy, number>> = { liberal: 6, fascist: 11 };
export const TOTAL_POLICIES = POLICY_MIX.liberal + POLICY_MIX.fascist;

/** Top of the pile is the LAST element, so a draw pops from the end. */
export type PolicyPile = readonly Policy[];

export const fullDeck = (): PolicyPile => [
  ...Array<Policy>(POLICY_MIX.liberal).fill("liberal"),
  ...Array<Policy>(POLICY_MIX.fascist).fill("fascist"),
];

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

/** The top `count` tiles without removing them, top-first. */
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
