import { expect, test } from "vitest";
import {
  BASE_CAST,
  CHARACTER_CATALOG,
  specOfCharacter,
  validateCast,
} from "../../../shared/core/lockstep/games/citadels/index.ts";
import { byRank, completeCast, defaultCast, missingRanks, pickCharacter } from "../cast.ts";

const ranksOf = (ids: readonly (string | null)[]): readonly number[] =>
  ids
    .filter((id): id is string => id !== null)
    .map((id) => specOfCharacter(id as Parameters<typeof specOfCharacter>[0]).rank);

test("pickCharacter replaces within a rank and never yields two of one rank", () => {
  const first = pickCharacter(defaultCast(), "witch");
  expect(first[1]).toBe("witch");

  const replaced = pickCharacter(first, "magistrate");
  expect(replaced[1]).toBe("magistrate");
  const ranks = ranksOf(Object.values(replaced));
  expect(new Set(ranks).size).toBe(ranks.length);
});

test("picking the same character again clears its rank slot", () => {
  const picked = pickCharacter(defaultCast(), "witch");
  expect(picked[1]).toBe("witch");
  expect(pickCharacter(picked, "witch")[1]).toBeNull();
});

test("completeCast is null until ranks 1..8 are filled", () => {
  const missingRank1 = pickCharacter(defaultCast(), "assassin");
  expect(completeCast(missingRank1)).toBeNull();
  expect(missingRanks(missingRank1)).toEqual([1]);
  expect(completeCast(pickCharacter(missingRank1, "witch"))).not.toBeNull();
});

test("a rank-9 pick yields a nine-character cast, and leaving it empty yields eight", () => {
  const eight = completeCast(defaultCast());
  expect(eight).not.toBeNull();
  expect(eight?.length).toBe(8);

  const nine = completeCast(pickCharacter(defaultCast(), "artist"));
  expect(nine).not.toBeNull();
  expect(nine?.length).toBe(9);
  expect(nine).toContain("artist");
});

test("completeCast returns ascending rank order and passes the shared validateCast", () => {
  const cast = completeCast(pickCharacter(defaultCast(), "queen"));
  expect(cast).not.toBeNull();
  if (cast === null) throw new Error("expected a complete cast");
  expect(ranksOf([...cast])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(() => validateCast(cast)).not.toThrow();
});

test("defaultCast completes to BASE_CAST", () => {
  expect(completeCast(defaultCast())).toEqual([...BASE_CAST]);
  expect(missingRanks(defaultCast())).toEqual([]);
});

test("missingRanks names the unfilled required ranks and ignores rank 9", () => {
  expect(missingRanks(pickCharacter(defaultCast(), "warlord"))).toEqual([8]);
  expect(missingRanks(pickCharacter(defaultCast(), "artist"))).toEqual([]);
});

test("byRank partitions the 27-character catalog across ranks 1..9", () => {
  expect(byRank.map((group) => group.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const catalog = byRank.flatMap((group) => group.characters.map((spec) => spec.id));
  expect(catalog.length).toBe(CHARACTER_CATALOG.length);
  expect(catalog.length).toBe(27);
  expect(new Set(catalog).size).toBe(catalog.length);
  for (const group of byRank) {
    expect(group.characters.every((spec) => spec.rank === group.rank)).toBe(true);
  }
});
