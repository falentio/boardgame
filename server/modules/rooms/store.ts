import { and, eq } from "drizzle-orm";
import type { Db } from "../../utils/db.ts";
import { room } from "../../db/schema.ts";
import type { RoomCode } from "../../../shared/rooms/ids.ts";
import type { Room } from "../../../shared/rooms/room.ts";
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
