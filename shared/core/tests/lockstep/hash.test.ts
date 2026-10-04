import { expect, test } from "vitest";
import {
  canonicalize,
  chainSeed,
  frameIndex,
  genesisSeed,
  makeRandom,
  seed,
  stateDigest,
} from "../../index.ts";

test("canonicalize sorts object keys and keeps array order", () => {
  expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  expect(canonicalize({ x: { d: true, c: null } })).toBe('{"x":{"c":null,"d":true}}');
});

test("canonicalize is stable for structurally equal values built in any order", () => {
  const first = { one: 1, two: [true, "x"], three: { nested: null } };
  const second = { three: { nested: null }, two: [true, "x"], one: 1 };
  expect(canonicalize(first)).toBe(canonicalize(second));
});

test("genesisSeed is deterministic and returns a 16-hex seed", () => {
  const a = genesisSeed("lobby-entropy");
  const b = genesisSeed("lobby-entropy");
  expect(a).toBe(b);
  expect(a).toMatch(/^[0-9a-f]{16}$/);
  expect(genesisSeed("other-entropy")).not.toBe(a);
});

test("chainSeed is a pure function of (seed, index, payload, stateDigest)", () => {
  const base = genesisSeed("lobby-entropy");
  const payload = { seat: "ann", input: { k: "idle" } };
  const digest = stateDigest({ coins: 3 });
  const first = chainSeed(base, frameIndex(0), payload, digest);
  expect(chainSeed(base, frameIndex(0), payload, digest)).toBe(first);
  expect(chainSeed(base, frameIndex(1), payload, digest)).not.toBe(first);
  expect(chainSeed(genesisSeed("other"), frameIndex(0), payload, digest)).not.toBe(first);
});

test("chainSeed commits to the state digest: same inputs, different state => different seed", () => {
  const base = genesisSeed("lobby-entropy");
  const payload = { seat: "ann", input: { k: "idle" } };
  const converged = chainSeed(base, frameIndex(0), payload, stateDigest({ coins: 3 }));
  const diverged = chainSeed(base, frameIndex(0), payload, stateDigest({ coins: 2 }));
  expect(diverged).not.toBe(converged);
});

test("stateDigest is stable across key insertion order and sensitive to value", () => {
  expect(stateDigest({ a: 1, b: 2 })).toBe(stateDigest({ b: 2, a: 1 }));
  expect(stateDigest({ a: 1 })).not.toBe(stateDigest({ a: 2 }));
  expect(stateDigest({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
});

test("makeRandom is reproducible and stays in range", () => {
  const a = makeRandom(seed("00000000000000ff"));
  const b = makeRandom(seed("00000000000000ff"));
  const streamA = Array.from({ length: 8 }, () => a.next());
  const streamB = Array.from({ length: 8 }, () => b.next());
  expect(streamA).toEqual(streamB);
  for (const value of streamA) {
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  }
});

test("makeRandom.int is bounded and shuffle is a permutation", () => {
  const rng = makeRandom(seed("00000000000000ff"));
  for (let i = 0; i < 20; i += 1) {
    const value = rng.int(6);
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(6);
  }
  const shuffled = rng.shuffle([1, 2, 3, 4, 5]);
  expect([...shuffled].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
});
