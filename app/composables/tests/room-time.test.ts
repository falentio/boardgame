import { expect, test } from "vitest";
import { formatRemaining } from "../room-time.ts";

test("formatRemaining returns nothing at or past the boundary", () => {
  expect(formatRemaining(0)).toBe("");
  expect(formatRemaining(-1)).toBe("");
  expect(formatRemaining(-3_600_000)).toBe("");
});

test("formatRemaining floors sub-minute time to <1m", () => {
  expect(formatRemaining(1)).toBe("<1m");
  expect(formatRemaining(59_999)).toBe("<1m");
});

test("formatRemaining renders whole minutes under an hour", () => {
  expect(formatRemaining(60_000)).toBe("1m");
  expect(formatRemaining(90_000)).toBe("1m");
  expect(formatRemaining(59 * 60_000)).toBe("59m");
});

test("formatRemaining renders hours and minutes over an hour", () => {
  expect(formatRemaining(60 * 60_000)).toBe("1h 0m");
  expect(formatRemaining(23 * 60 * 60_000 + 59 * 60_000)).toBe("23h 59m");
  expect(formatRemaining(24 * 60 * 60_000)).toBe("24h 0m");
});
