type Brand<T, B extends string> = T & { readonly __brand: B };

export type RoomId = Brand<string, "RoomId">;
export type RoomCode = Brand<string, "RoomCode">;
export type UserId = Brand<string, "UserId">;

export { seatId, type SeatId } from "../core/lockstep/ids.ts";

export class RoomIdError extends Error {
  override readonly name = "RoomIdError";
}

export const CONSONANTS = "BCDGHJLMNPRTWYZ";
export const VOWELS = "AEIOU";

const CODE_PATTERN = new RegExp(`^(?:[${CONSONANTS}][${VOWELS}]){4}$`);

export const isRoomCode = (raw: string): boolean => CODE_PATTERN.test(raw);

export const roomId = (raw: string): RoomId => {
  if (raw.length === 0) throw new RoomIdError("room id must be non-empty");
  return raw as RoomId;
};

export const userId = (raw: string): UserId => {
  if (raw.length === 0) throw new RoomIdError("user id must be non-empty");
  return raw as UserId;
};

export const roomCode = (raw: string): RoomCode => {
  if (!isRoomCode(raw)) {
    throw new RoomIdError(`room code must be 8 chars CVCVCVCV, got ${raw}`);
  }
  return raw as RoomCode;
};
