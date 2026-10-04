import { seed, type FrameIndex, type Seed } from "./ids.ts";
import { canonicalize, type Json } from "./json.ts";

/**
 * Deterministic digest and seeded PRNG. No dependency, no ambient entropy. Both
 * algorithms below are load-bearing: a peer that computes a different value
 * forks the log, so they are pinned here and must stay stable across peers.
 *
 * Digest: FNV-1a, 64-bit, over the UTF-16 code units of the input string. A
 * `Seed` is the 64-bit result rendered as 16 lowercase hex chars.
 *
 * Seed chain: `seed_{f+1} = digest(seed_f, f, payload_f, stateDigest_f)` where
 * `payload_f` is the canonical form of the sealed frame's inputs (see
 * `framePayload`) and `stateDigest_f` is the digest of the state the frame
 * produced (see `stateDigest`). The concatenation is
 * `"<seed>:<index>:<canonical>:<stateDigest>"`. Committing to the resulting
 * state — not just the inputs — is what makes two peers that fold the same
 * inputs but reach different state diverge *loudly*: the next frame's seed no
 * longer chains, so the receiver rejects it instead of silently forking.
 *
 * PRNG: mulberry32, seeded by folding the 64-bit seed to 32 bits. Same seed =>
 * same stream, on every peer.
 */

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK64 = 0xffffffffffffffffn;

const fnv1a64 = (input: string): bigint => {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * FNV_PRIME) & MASK64;
  }
  return hash;
};

const toSeed = (value: bigint): Seed => seed(value.toString(16).padStart(16, "0"));

/** Hash agreed lobby entropy into the genesis seed. Identical bytes on every peer. */
export const genesisSeed = (entropy: string): Seed => toSeed(fnv1a64(entropy));

/**
 * Digest of an encoded game state, in the same `Seed` shape as every other hash
 * so it can be folded into the chain. `canonicalize` makes it a pure function of
 * the state value, independent of key insertion order.
 */
export const stateDigest = (encoded: Json): Seed => toSeed(fnv1a64(canonicalize(encoded)));

/**
 * Derive the seed for frame `index + 1` from the seed frame `index` is stepped
 * with, the frame's agreed payload, and the digest of the state that frame
 * produced. Pure in all four arguments.
 */
export const chainSeed = (prev: Seed, index: FrameIndex, payload: Json, state: Seed): Seed =>
  toSeed(fnv1a64(`${prev}:${String(index)}:${canonicalize(payload)}:${state}`));

export interface Random {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Fisher-Yates using `int`; returns a new array, leaving the input untouched. */
  shuffle<T>(items: readonly T[]): readonly T[];
}

const foldToInt32 = (value: Seed): number => {
  const wide = BigInt(`0x${value}`);
  return Number((wide >> 32n) ^ (wide & 0xffffffffn)) >>> 0;
};

export const makeRandom = (value: Seed): Random => {
  let state = foldToInt32(value);
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError(`int bound must be a positive integer, got ${String(maxExclusive)}`);
      }
      return Math.floor(next() * maxExclusive);
    },
    shuffle<T>(items: readonly T[]): readonly T[] {
      const result = [...items];
      for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        const a = result[i]!;
        const b = result[j]!;
        result[i] = b;
        result[j] = a;
      }
      return result;
    },
  };
};
