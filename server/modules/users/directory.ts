import { inArray } from "drizzle-orm";
import { userId, type UserId } from "../../../shared/rooms/ids.ts";
import { user } from "../../db/schema.ts";
import type { Db } from "../../utils/db.ts";

export interface OccupantIdentity {
  readonly name: string;
  readonly image: string | null;
}

export type OccupantDirectory = ReadonlyMap<UserId, OccupantIdentity>;

export const occupantsOf = async (
  db: Db,
  ids: readonly UserId[],
): Promise<OccupantDirectory> => {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(user)
    .where(inArray(user.id, ids));
  return new Map(rows.map((row) => [userId(row.id), { name: row.name, image: row.image }]));
};
