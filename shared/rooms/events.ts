import type { RoomCode } from "./ids.ts";
import type { Room } from "./room.ts";

export type ChangeReason = "created" | "joined" | "updated" | "deleted";

export interface RoomChangedSignal {
  readonly code: RoomCode;
  readonly reason: ChangeReason;
}

export interface RoomEvents {
  changed(room: Room, reason: ChangeReason): Promise<void>;
}

export const ROOM_CHANGED = "room-changed";

export const roomChannel = (code: RoomCode): `private-room-${string}` =>
  `private-room-${code}`;
