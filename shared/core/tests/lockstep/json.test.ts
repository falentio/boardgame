import { expect, test } from "vitest";
import { asJson, canonicalize, CodecError, field, type Json } from "../../index.ts";

test("asJson turns a __proto__ wire key into an own property, not a prototype write", () => {
  const parsed = asJson(JSON.parse('{"__proto__":{"polluted":true},"ok":1}'));
  const object = parsed as { readonly [key: string]: Json };
  // The key survives as an own property...
  expect(Object.hasOwn(object, "__proto__")).toBe(true);
  // ...and the prototype was not mutated.
  expect((object as Record<string, unknown>)["polluted"]).toBeUndefined();
  expect(Object.getPrototypeOf(object)).toBeNull();
});

test("canonicalize does not collide {} with {__proto__: ...}", () => {
  const empty = asJson(JSON.parse("{}"));
  const proto = asJson(JSON.parse('{"__proto__":1}'));
  expect(canonicalize(empty)).toBe("{}");
  expect(canonicalize(proto)).toBe('{"__proto__":1}');
  expect(canonicalize(proto)).not.toBe(canonicalize(empty));
});

test("field reads own properties only, never inherited ones", () => {
  const object = asJson(JSON.parse('{"a":1}')) as { readonly [key: string]: Json };
  expect(field(object, "a")).toBe(1);
  // Inherited Object.prototype members must not satisfy a field read.
  expect(() => field(object, "toString")).toThrow(CodecError);
  expect(() => field(object, "hasOwnProperty")).toThrow(CodecError);
  expect(() => field(object, "constructor")).toThrow(CodecError);
  expect(() => field(object, "missing")).toThrow(CodecError);
});
