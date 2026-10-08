/**
 * Branded identifiers. A raw string or number becomes a domain id only here;
 * every other module trusts the brand. Each constructor validates first, so the
 * single cast is a checked narrowing at the parse boundary rather than a claim
 * the compiler cannot see.
 */

type Brand<T, B extends string> = T & { readonly __brand: B };

export type GameId = Brand<string, "GameId">;
export type SeatId = Brand<string, "SeatId">;
export type FrameIndex = Brand<number, "FrameIndex">;
export type Seed = Brand<string, "Seed">;
export type Deadline = Brand<number, "Deadline">;

export const gameId = (raw: string): GameId => {
  if (raw.length === 0) throw new IdError("game id must be non-empty");
  return raw as GameId;
};

export const seatId = (raw: string): SeatId => {
  if (raw.length === 0) throw new IdError("seat id must be non-empty");
  return raw as SeatId;
};

export const frameIndex = (raw: number): FrameIndex => {
  if (!Number.isInteger(raw) || raw < 0) {
    throw new IdError(`frame index must be a non-negative integer, got ${String(raw)}`);
  }
  return raw as FrameIndex;
};

export const nextFrameIndex = (frame: FrameIndex): FrameIndex => frameIndex(frame + 1);

const SEED_PATTERN = /^[0-9a-f]{16}$/;

export const seed = (raw: string): Seed => {
  if (!SEED_PATTERN.test(raw)) {
    throw new IdError(`seed must be 16 lowercase hex chars, got ${raw}`);
  }
  return raw as Seed;
};

export const deadline = (raw: number): Deadline => {
  if (!Number.isFinite(raw)) {
    throw new IdError(`deadline must be a finite ms instant, got ${String(raw)}`);
  }
  return raw as Deadline;
};

export class IdError extends Error {
  override readonly name = "IdError";
}
