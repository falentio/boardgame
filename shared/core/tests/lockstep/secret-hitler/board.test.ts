import { expect, test } from "vitest";
import {
  FASCIST_BOARD,
  FASCIST_TEAM,
  HITLER_CHANCELLOR_FASCIST,
  LIBERAL_LIMIT,
  MIN_SEATS,
  MAX_SEATS,
  POLICY_MIX,
  VETO_UNLOCK_FASCIST,
  boardFor,
  boardLimit,
  boardSlot,
  fullDeck,
  powerFor,
  rolesFor,
  vetoUnlocked,
  votePasses,
  type PlayerCount,
  type PowerId,
} from "./driver.ts";

const COUNTS: readonly PlayerCount[] = [5, 6, 7, 8, 9, 10];

test("the board table covers every player count, each row ending in the fascist win", () => {
  for (const count of COUNTS) {
    const row = boardFor(count);
    expect(row.length).toBe(6);
    expect(row[row.length - 1]).toEqual({ kind: "fascist-win" });
    expect(row.slice(0, -1).every((slot) => slot.kind !== "fascist-win")).toBe(true);
  }
});

test("boardLimit IS the row length, so the power line and the fascist win cannot drift", () => {
  for (const count of COUNTS) {
    expect(boardLimit(count)).toBe(FASCIST_BOARD[count].length);
    expect(boardLimit(count)).toBe(6);
  }
});

test("powerFor and boardSlot read the same row: the power at each fascist count matches the printed board", () => {
  // The rulebook's power table [docs/research/secret-hitler/rules.md section 4].
  const expected: Readonly<Record<PlayerCount, readonly (PowerId | null)[]>> = {
    5: [null, null, "policy-peek", "execution", "execution"],
    6: [null, null, "policy-peek", "execution", "execution"],
    7: [null, "investigate-loyalty", "special-election", "execution", "execution"],
    8: [null, "investigate-loyalty", "special-election", "execution", "execution"],
    9: ["investigate-loyalty", "investigate-loyalty", "special-election", "execution", "execution"],
    10: ["investigate-loyalty", "investigate-loyalty", "special-election", "execution", "execution"],
  };
  for (const count of COUNTS) {
    for (let n = 1; n <= 5; n += 1) {
      expect(powerFor(count, n)).toBe(expected[count][n - 1]);
      const slot = boardSlot(count, n);
      expect(slot.kind === "power" ? slot.power : null).toBe(expected[count][n - 1]);
    }
    expect(boardSlot(count, 6)).toEqual({ kind: "fascist-win" });
    expect(powerFor(count, 6)).toBeNull();
  }
});

test("the win slot and no-power are distinct from a power id", () => {
  expect(boardSlot(5, 1)).toEqual({ kind: "none" });
  expect(boardSlot(5, 6)).toEqual({ kind: "fascist-win" });
  expect(boardSlot(5, 3)).toEqual({ kind: "power", power: "policy-peek" });
});

test("veto unlocks at five fascist policies, at every count", () => {
  expect(VETO_UNLOCK_FASCIST).toBe(5);
  expect(vetoUnlocked(0)).toBe(false);
  expect(vetoUnlocked(4)).toBe(false);
  expect(vetoUnlocked(5)).toBe(true);
  expect(vetoUnlocked(6)).toBe(true);
});

test("the two win lines and the hitler threshold match the rulebook", () => {
  expect(LIBERAL_LIMIT).toBe(5);
  expect(HITLER_CHANCELLOR_FASCIST).toBe(3);
  for (const count of COUNTS) expect(boardLimit(count)).toBe(6);
});

test("a tie vote fails and a strict majority passes", () => {
  // A tie fails [RB p4]: 2 yes of 4 voters is a tie, not a pass.
  expect(votePasses(2, 4)).toBe(false);
  expect(votePasses(3, 5)).toBe(true);
  expect(votePasses(3, 6)).toBe(false);
  expect(votePasses(4, 6)).toBe(true);
  expect(votePasses(0, 0)).toBe(false);
  expect(votePasses(1, 1)).toBe(true);
});

test("the role multiset matches the rulebook setup table at every count", () => {
  // [RB p2] table: 5: 3L+1F+H, 6: 4L+1F+H, 7: 4L+2F+H, 8: 5L+2F+H, 9: 5L+3F+H, 10: 6L+3F+H.
  const expected: Readonly<Record<PlayerCount, { liberal: number; fascist: number; hitler: number }>> = {
    5: { liberal: 3, fascist: 1, hitler: 1 },
    6: { liberal: 4, fascist: 1, hitler: 1 },
    7: { liberal: 4, fascist: 2, hitler: 1 },
    8: { liberal: 5, fascist: 2, hitler: 1 },
    9: { liberal: 5, fascist: 3, hitler: 1 },
    10: { liberal: 6, fascist: 3, hitler: 1 },
  };
  for (const count of COUNTS) {
    const roles = rolesFor(count);
    expect(roles.length).toBe(count);
    expect(roles.filter((role) => role === "liberal").length).toBe(expected[count].liberal);
    expect(roles.filter((role) => role === "fascist").length).toBe(expected[count].fascist);
    expect(roles.filter((role) => role === "hitler").length).toBe(expected[count].hitler);
    expect(FASCIST_TEAM[count]).toBe(expected[count].fascist + expected[count].hitler);
  }
});

test("the policy deck is 6 liberal and 11 fascist", () => {
  expect(POLICY_MIX).toEqual({ liberal: 6, fascist: 11 });
  const deck = fullDeck();
  expect(deck.length).toBe(17);
  expect(deck.filter((card) => card === "liberal").length).toBe(6);
  expect(deck.filter((card) => card === "fascist").length).toBe(11);
});

test("the player count bounds are 5 and 10", () => {
  expect(MIN_SEATS).toBe(5);
  expect(MAX_SEATS).toBe(10);
});
