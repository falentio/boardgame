import { expect, test } from "vitest";
import { DEFAULT_AVATAR_BASE, defaultAvatarUrl, resolveUserImage } from "../avatar.ts";

test("defaultAvatarUrl seeds the dicebear URL with the user id", () => {
  expect(defaultAvatarUrl("abc")).toBe("https://api.dicebear.com/10.x/clay/svg?seed=abc");
  expect(DEFAULT_AVATAR_BASE).toBe("https://api.dicebear.com/10.x/clay/svg");
});

test("defaultAvatarUrl URL-encodes ids with special characters", () => {
  expect(defaultAvatarUrl("a b/c?d")).toBe(`${DEFAULT_AVATAR_BASE}?seed=a%20b%2Fc%3Fd`);
});

test("defaultAvatarUrl falls back to a stable seed for an empty or whitespace id", () => {
  expect(defaultAvatarUrl("")).toBe(`${DEFAULT_AVATAR_BASE}?seed=anonymous`);
  expect(defaultAvatarUrl("   ")).toBe(`${DEFAULT_AVATAR_BASE}?seed=anonymous`);
  expect(defaultAvatarUrl("")).not.toBe(`${DEFAULT_AVATAR_BASE}?seed=`);
});

test("resolveUserImage keeps a provided image", () => {
  expect(resolveUserImage("https://x/y.png", "abc")).toBe("https://x/y.png");
});

test("resolveUserImage falls back to the seeded default when no image is provided", () => {
  const expected = `${DEFAULT_AVATAR_BASE}?seed=abc`;
  expect(resolveUserImage(null, "abc")).toBe(expected);
  expect(resolveUserImage(undefined, "abc")).toBe(expected);
  expect(resolveUserImage("", "abc")).toBe(expected);
  expect(resolveUserImage("   ", "abc")).toBe(expected);
});
