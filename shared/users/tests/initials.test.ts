import { expect, test } from "vitest";
import { initialsOf } from "../initials.ts";

test("initialsOf reads the first and last word", () => {
  expect(initialsOf("Amara Okonkwo")).toBe("AO");
});

test("initialsOf takes the first and last of three words", () => {
  expect(initialsOf("Ana Maria Silva")).toBe("AS");
});

test("initialsOf uses a single word once", () => {
  expect(initialsOf("host")).toBe("H");
});

test("initialsOf returns ? for empty, blank, null, and undefined", () => {
  expect(initialsOf("")).toBe("?");
  expect(initialsOf("   ")).toBe("?");
  expect(initialsOf(null)).toBe("?");
  expect(initialsOf(undefined)).toBe("?");
});

test("initialsOf uppercases and trims", () => {
  expect(initialsOf("  wei   zhang  ")).toBe("WZ");
});
