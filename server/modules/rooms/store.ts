import { and, eq, lte } from "drizzle-orm";
import type { Db } from "../../utils/db.ts";
import { room } from "../../db/schema.ts";
import type { RoomCode, RoomId } from "../../../shared/rooms/ids.ts";
import { ROOM_TTL_MS, type Room } from "../../../shared/rooms/room.ts";
import { toRoom, toRow, type LoadedRoom } from "./row.ts";

export type { LoadedRoom } from "./row.ts";

const isUniqueViolation = (error: unknown): boolean => {
  let current: unknown = error;
  while (current instanceof Error) {
    if (/UNIQUE constraint failed/i.test(current.message)) return true;
    current = current.cause;
  }
  return false;
};

export const insertRoom = async (db: Db, value: Room): Promise<"ok" | "code-taken"> => {
  try {
    await db.insert(room).values(toRow(value, 0));
    return "ok";
  } catch (error) {
    if (isUniqueViolation(error)) return "code-taken";
    throw error;
  }
};

export const roomByCode = async (db: Db, code: RoomCode): Promise<LoadedRoom | null> => {
  const rows = await db.select().from(room).where(eq(room.code, code)).limit(1);
  const row = rows[0];
  return row === undefined ? null : toRoom(row);
};

export const saveRoom = async (
  db: Db,
  value: Room,
  expectedRevision: number,
): Promise<boolean> => {
  const updated = await db
    .update(room)
    .set(toRow(value, expectedRevision + 1))
    .where(and(eq(room.code, value.code), eq(room.revision, expectedRevision)))
    .returning({ id: room.id });
  return updated.length === 1;
};

export const removeRoom = async (db: Db, value: Room): Promise<void> => {
  await db.delete(room).where(eq(room.code, value.code));
};

export const deleteExpiredRooms = async (db: Db, now: number): Promise<number> => {
  const removed = await db
    .delete(room)
    .where(lte(room.createdAt, new Date(now - ROOM_TTL_MS)))
    .returning({ id: room.id });
  return removed.length;
};

export const removeRoomIf = async (
  db: Db,
  id: RoomId,
  expectedRevision: number,
): Promise<boolean> => {
  const removed = await db
    .delete(room)
    .where(and(eq(room.id, id), eq(room.revision, expectedRevision)))
    .returning({ id: room.id });
  return removed.length === 1;
};
