import { expect, test } from "vitest";
import { CodecError, expectInteger, expectNumber } from "../../index.ts";

test("expectNumber rejects NaN and Infinity", () => {
  expect(expectNumber(3, "n")).toBe(3);
  expect(expectNumber(3.5, "n")).toBe(3.5);
  expect(() => expectNumber(Number.NaN, "n")).toThrow(CodecError);
  expect(() => expectNumber(Number.POSITIVE_INFINITY, "n")).toThrow(CodecError);
  expect(() => expectNumber(Number.NEGATIVE_INFINITY, "n")).toThrow(CodecError);
});

test("expectInteger rejects NaN, Infinity, and non-integers", () => {
  expect(expectInteger(3, "n")).toBe(3);
  expect(expectInteger(-2, "n")).toBe(-2);
  expect(() => expectInteger(3.5, "n")).toThrow(CodecError);
  expect(() => expectInteger(Number.NaN, "n")).toThrow(CodecError);
  expect(() => expectInteger(Number.POSITIVE_INFINITY, "n")).toThrow(CodecError);
});
