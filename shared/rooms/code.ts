import type { Random } from "../core/lockstep/hash.ts";
import { CODE_PAIRS, CONSONANTS, VOWELS, isRoomCode, roomCode, type RoomCode } from "./ids.ts";

const PREFIXES = ["", ...VOWELS] as const;
export const CODE_LENGTHS = [CODE_PAIRS * 2, CODE_PAIRS * 2 + 1] as const;
export const CODE_SPACE_SIZE =
  PREFIXES.length * CONSONANTS.length ** CODE_PAIRS * VOWELS.length ** CODE_PAIRS;

export type RoomEntropy = Pick<Random, "int">;

export const generateCode = (entropy: RoomEntropy): RoomCode => {
  let raw: string = PREFIXES[entropy.int(PREFIXES.length)]!;
  for (let pair = 0; pair < CODE_PAIRS; pair += 1) {
    raw += CONSONANTS[entropy.int(CONSONANTS.length)]!;
    raw += VOWELS[entropy.int(VOWELS.length)]!;
  }
  return roomCode(raw);
};

export const parseRoomCode = (raw: string): RoomCode | null => {
  const normalized = raw.trim().toUpperCase();
  return isRoomCode(normalized) ? roomCode(normalized) : null;
};
