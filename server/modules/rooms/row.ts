import type { InferSelectModel } from "drizzle-orm";
import { roomCode, roomId, userId } from "../../../shared/rooms/ids.ts";
import type { Room } from "../../../shared/rooms/room.ts";
import type { room } from "../../db/schema.ts";

export type RoomRow = InferSelectModel<typeof room>;

export interface LoadedRoom {
  room: Room;
  revision: number;
}

export const toRoom = (row: RoomRow): LoadedRoom => ({
  room: {
    id: roomId(row.id),
    code: roomCode(row.code),
    host: userId(row.hostId),
    name: row.name,
    setup: row.setup,
    seats: row.seats,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    startedAt: row.startedAt === null ? null : row.startedAt.getTime(),
  },
  revision: row.revision,
});

export const toRow = (room: Room, revision: number): RoomRow => ({
  id: room.id,
  code: room.code,
  hostId: room.host,
  name: room.name,
  setup: room.setup,
  seats: [...room.seats],
  revision,
  createdAt: new Date(room.createdAt),
  updatedAt: new Date(room.updatedAt),
  startedAt: room.startedAt === null ? null : new Date(room.startedAt),
});
