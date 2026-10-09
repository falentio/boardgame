import type { Random } from "../core/lockstep/hash.ts";
import { CONSONANTS, VOWELS, isRoomCode, roomCode, type RoomCode } from "./ids.ts";

export const CODE_LENGTH = 8;
export const CODE_SPACE_SIZE = CONSONANTS.length ** 4 * VOWELS.length ** 4;

export type RoomEntropy = Pick<Random, "int">;

export const generateCode = (entropy: RoomEntropy): RoomCode => {
  let raw = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    const alphabet = index % 2 === 0 ? CONSONANTS : VOWELS;
    raw += alphabet[entropy.int(alphabet.length)]!;
  }
  return roomCode(raw);
};

export const parseRoomCode = (raw: string): RoomCode | null => {
  const normalized = raw.trim().toUpperCase();
  return isRoomCode(normalized) ? roomCode(normalized) : null;
};
