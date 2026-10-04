import type { RoomEntropy } from "../../../shared/rooms/code.ts";

const UINT32_RANGE = 0x1_0000_0000;

export const cryptoEntropy = (): RoomEntropy => ({
  int(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(`int bound must be a positive integer, got ${String(maxExclusive)}`);
    }
    const limit = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
    const buffer = new Uint32Array(1);
    let value: number;
    do {
      crypto.getRandomValues(buffer);
      value = buffer[0]!;
    } while (value >= limit);
    return value % maxExclusive;
  },
});
