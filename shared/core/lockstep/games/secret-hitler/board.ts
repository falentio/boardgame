import { SecretHitlerError } from "./error.ts";
import type { PlayerCount } from "./roles.ts";

/** The four Executive Actions printed on the Fascist boards [RB p5, PNP]. */
export type PowerId = "investigate-loyalty" | "special-election" | "policy-peek" | "execution";

/**
 * One cell of a Fascist board row. The win slot is distinct from "no power" and
 * from a power id, so `powerFor` cannot confuse the win line with a blank.
 */
export type BoardSlot =
  | { readonly kind: "none" }
  | { readonly kind: "power"; readonly power: PowerId }
  | { readonly kind: "fascist-win" };

const NONE: BoardSlot = { kind: "none" };
const WIN: BoardSlot = { kind: "fascist-win" };
const pow = (power: PowerId): BoardSlot => ({ kind: "power", power });

/**
 * Slot i is what the (i+1)-th Fascist Policy does: a power, nothing, or the win.
 * The row's length IS the Fascist win line, so the power a policy grants and the
 * length at which the Fascists win cannot drift [PNP 5-6/7-8/9-10 boards; RB p2, p5].
 */
export const FASCIST_BOARD: Readonly<Record<PlayerCount, readonly BoardSlot[]>> = {
  5: [NONE, NONE, pow("policy-peek"), pow("execution"), pow("execution"), WIN],
  6: [NONE, NONE, pow("policy-peek"), pow("execution"), pow("execution"), WIN],
  7: [
    NONE,
    pow("investigate-loyalty"),
    pow("special-election"),
    pow("execution"),
    pow("execution"),
    WIN,
  ],
  8: [
    NONE,
    pow("investigate-loyalty"),
    pow("special-election"),
    pow("execution"),
    pow("execution"),
    WIN,
  ],
  9: [
    pow("investigate-loyalty"),
    pow("investigate-loyalty"),
    pow("special-election"),
    pow("execution"),
    pow("execution"),
    WIN,
  ],
  10: [
    pow("investigate-loyalty"),
    pow("investigate-loyalty"),
    pow("special-election"),
    pow("execution"),
    pow("execution"),
    WIN,
  ],
};

/** Five Liberal Policies end the game for the Liberals [RB p2]. */
export const LIBERAL_LIMIT = 5;

export const boardFor = (count: PlayerCount): readonly BoardSlot[] => FASCIST_BOARD[count];

/** The Fascist Policies needed to win: the length of the board row. */
export const boardLimit = (count: PlayerCount): number => boardFor(count).length;

export const boardSlot = (count: PlayerCount, fascistCount: number): BoardSlot => {
  const slot = boardFor(count)[fascistCount - 1];
  if (slot === undefined) {
    throw new SecretHitlerError(
      `no board slot for fascist policy ${String(fascistCount)} at ${String(count)} players`,
    );
  }
  return slot;
};

/** The power the `fascistCount`-th Fascist Policy grants, or null. */
export const powerFor = (count: PlayerCount, fascistCount: number): PowerId | null => {
  const slot = boardSlot(count, fascistCount);
  return slot.kind === "power" ? slot.power : null;
};

/** Veto unlocks once five Fascist Policies are on the board, for all later governments [RB p6]. */
export const VETO_UNLOCK_FASCIST = 5;
export const vetoUnlocked = (fascistPolicies: number): boolean =>
  fascistPolicies >= VETO_UNLOCK_FASCIST;

/** Hitler elected Chancellor wins for the Fascists once three Fascist Policies are on the board [RB p4]. */
export const HITLER_CHANCELLOR_FASCIST = 3;

/** A tie fails; a strict majority of the living, voting seats passes [RB p4]. */
export const votePasses = (yes: number, voters: number): boolean => yes * 2 > voters;
