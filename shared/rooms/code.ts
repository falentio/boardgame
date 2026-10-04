import type { Random } from "../core/lockstep/hash.ts";
import { isRoomCode, roomCode, type RoomCode } from "./ids.ts";

export const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ";
export const VOWELS = "AEIOU";
export const CODE_LENGTH = 8;
export const CODE_SPACE_SIZE = 21 ** 4 * 5 ** 4;

export type RoomEntropy = Pick<Random, "int">;

export const generateCode = (entropy: RoomEntropy): RoomCode => {
  let raw = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    const alphabet = index % 2 === 0 ? CONSONANTS : VOWELS;
    raw += alphabet[entropy.int(alphabet.length)]!;
  }
  return roomCode(raw);
};

export const parseRoomCode = (raw: string): RoomCode | null =>
  isRoomCode(raw) ? roomCode(raw) : null;
