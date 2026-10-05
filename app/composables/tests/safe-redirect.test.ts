import { expect, test } from "vitest";
import { sameOriginPath } from "../safe-redirect.ts";

const ORIGIN = "http://localhost";

test("honors a same-origin path, its query, and its hash", () => {
  expect(sameOriginPath("/rooms/ABC", ORIGIN)).toBe("/rooms/ABC");
  expect(sameOriginPath("/a/b?x=1#h", ORIGIN)).toBe("/a/b?x=1#h");
  expect(sameOriginPath("/", ORIGIN)).toBe("/");
});

test("collapses dot segments to a same-origin path", () => {
  expect(sameOriginPath("/./x", ORIGIN)).toBe("/x");
  expect(sameOriginPath("/a/../b", ORIGIN)).toBe("/b");
  expect(sameOriginPath("/../etc", ORIGIN)).toBe("/etc");
});

test("rejects a cross-origin or protocol-relative value", () => {
  expect(sameOriginPath("https://evil.example.com", ORIGIN)).toBe("/");
  expect(sameOriginPath("//evil.example.com", ORIGIN)).toBe("/");
  expect(sameOriginPath("///evil", ORIGIN)).toBe("/");
  expect(sameOriginPath("javascript:alert(1)", ORIGIN)).toBe("/");
  expect(sameOriginPath("http://evil.example.com/x", ORIGIN)).toBe("/");
});

test("rejects a backslash that reads as a slash", () => {
  expect(sameOriginPath("/\\evil.com", ORIGIN)).toBe("/");
  expect(sameOriginPath("\\/evil.com", ORIGIN)).toBe("/");
});

test("rejects a path that collapses back to protocol-relative", () => {
  expect(sameOriginPath("/..//evil.com", ORIGIN)).toBe("/");
  expect(sameOriginPath("/.//evil.com", ORIGIN)).toBe("/");
  expect(sameOriginPath("/%2e%2e//evil.com", ORIGIN)).toBe("/");
  expect(sameOriginPath("/x/..//evil.com", ORIGIN)).toBe("/");
  expect(sameOriginPath("http://localhost//evil.com", ORIGIN)).toBe("/");
  expect(sameOriginPath("//localhost//evil.com", ORIGIN)).toBe("/");
  expect(sameOriginPath("http://user@localhost//evil.com", ORIGIN)).toBe("/");
  expect(sameOriginPath("/..///x", ORIGIN)).toBe("/");
});

test("falls back to root for a missing or non-string value", () => {
  expect(sameOriginPath(undefined, ORIGIN)).toBe("/");
  expect(sameOriginPath("", ORIGIN)).toBe("/");
  expect(sameOriginPath(42, ORIGIN)).toBe("/");
});
