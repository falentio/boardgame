import { eq } from "drizzle-orm";
import { afterEach, beforeEach, expect, test } from "vitest";
import { roomCode, roomId, userId } from "../../../../shared/rooms/ids.ts";
import { createRoom, type Room } from "../../../../shared/rooms/room.ts";
import { BASE_CAST } from "../../../../shared/core/lockstep/games/citadels/characters.ts";
import { STARTER_ROLES } from "../../../../shared/core/lockstep/games/g54/roles.ts";
import type { RoomSetup } from "../../../../shared/rooms/games.ts";
import { user } from "../../../db/schema.ts";
import {
  deleteExpiredRooms,
  insertRoom,
  removeRoom,
  removeRoomIf,
  roomByCode,
  saveRoom,
} from "../store.ts";
import { createTestDb, type TestDb } from "./d1-harness.ts";
import { room } from "../../../db/schema.ts";

const SETUP: RoomSetup = { game: "g54", roles: STARTER_ROLES };
const HOST = userId("user-host");

let harness: TestDb;

beforeEach(async () => {
  harness = await createTestDb();
  await harness.db.insert(user).values({
    id: HOST,
    name: "Host",
    email: "host@example.com",
    emailVerified: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  });
});

afterEach(async () => {
  await harness.dispose();
});

const aRoom = (overrides: Partial<Omit<Parameters<typeof createRoom>[0], "startedAt">> = {}): Room => {
  const result = createRoom({
    id: roomId("room-1"),
    code: roomCode("GAJUDIRU"),
    host: HOST,
    name: "Alpha",
    seats: 3,
    setup: SETUP,
    now: 1000,
    ...overrides,
  });
  if (!result.ok) throw new Error(`expected a room, got ${result.error.kind}`);
  return result.value;
};

test("insertRoom then roomByCode round-trips every field with revision 0", async () => {
  const room = aRoom();
  expect(await insertRoom(harness.db, room)).toBe("ok");

  const loaded = await roomByCode(harness.db, room.code);
  expect(loaded).not.toBeNull();
  expect(loaded!.revision).toBe(0);
  expect(loaded!.room).toEqual(room);
  expect(loaded!.room.startedAt).toBeNull();
});

test("saveRoom round-trips a set startedAt", async () => {
  const room = aRoom();
  await insertRoom(harness.db, room);

  const started: Room = { ...room, startedAt: 5000, updatedAt: 5000 };
  expect(await saveRoom(harness.db, started, 0)).toBe(true);

  const after = await roomByCode(harness.db, room.code);
  expect(after!.room.startedAt).toBe(5000);
});

test("a citadels room round-trips its cast", async () => {
  const room = aRoom({ setup: { game: "citadels", cast: BASE_CAST } });
  expect(await insertRoom(harness.db, room)).toBe("ok");

  const loaded = await roomByCode(harness.db, room.code);
  expect(loaded!.room.setup).toEqual({ game: "citadels", cast: BASE_CAST });
  expect(loaded!.room).toEqual(room);
});

const backfillStatements = (): readonly string[] => {
  const files = import.meta.glob("../../../../drizzle/0003_*.sql", {
    query: "?raw",
    import: "default",
    eager: true,
  });
  return Object.values(files)
    .flatMap((sql) => sql.split("--> statement-breakpoint"))
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
};

const legacyRow = (code: string, id: string) => ({
  id: roomId(id),
  code: roomCode(code),
  hostId: HOST,
  name: "Legacy",
  setup: { roles: STARTER_ROLES } as unknown as RoomSetup,
  seats: [],
  revision: 0,
  createdAt: new Date(1000),
  updatedAt: new Date(1000),
  startedAt: null,
});

test("the 0003 backfill tags a legacy tagless row as a g54 room", async () => {
  await harness.db.insert(room).values(legacyRow("GAJUDIRU", "room-legacy"));
  await harness.db.insert(room).values(legacyRow("BAJUDIRU", "room-tagged"));
  await harness.db.update(room).set({ setup: SETUP }).where(eq(room.code, roomCode("BAJUDIRU")));

  for (const statement of backfillStatements()) {
    await harness.env.DB.prepare(statement).run();
  }

  const migrated = await roomByCode(harness.db, roomCode("GAJUDIRU"));
  expect(migrated!.room.setup).toEqual({ game: "g54", roles: STARTER_ROLES });

  const tagged = await roomByCode(harness.db, roomCode("BAJUDIRU"));
  expect(tagged!.room.setup).toEqual(SETUP);

  for (const statement of backfillStatements()) {
    await harness.env.DB.prepare(statement).run();
  }
  const again = await roomByCode(harness.db, roomCode("GAJUDIRU"));
  expect(again!.room.setup).toEqual({ game: "g54", roles: STARTER_ROLES });
});

test("roomByCode is an exact-match lookup and misses for an unknown code", async () => {
  await insertRoom(harness.db, aRoom());
  expect(await roomByCode(harness.db, roomCode("BAJUDIRU"))).toBeNull();
});

test("a duplicate code is refused by the unique index, not by a read", async () => {
  expect(await insertRoom(harness.db, aRoom())).toBe("ok");
  const clash = aRoom({ id: roomId("room-2") });
  expect(await insertRoom(harness.db, clash)).toBe("code-taken");
});

test("saveRoom bumps revision on a matching CAS and reports false when revision moved", async () => {
  const room = aRoom();
  await insertRoom(harness.db, room);
  const loaded = await roomByCode(harness.db, room.code);

  const renamed: Room = { ...room, name: "Beta", updatedAt: 2000 };
  expect(await saveRoom(harness.db, renamed, loaded!.revision)).toBe(true);
  const after = await roomByCode(harness.db, room.code);
  expect(after!.revision).toBe(1);
  expect(after!.room.name).toBe("Beta");

  expect(await saveRoom(harness.db, renamed, loaded!.revision)).toBe(false);
  expect((await roomByCode(harness.db, room.code))!.revision).toBe(1);
});

test("saveRoom on a missing room reports false", async () => {
  expect(await saveRoom(harness.db, aRoom(), 0)).toBe(false);
});

test("removeRoom deletes the row so the code becomes free again", async () => {
  const room = aRoom();
  await insertRoom(harness.db, room);
  await removeRoom(harness.db, room);
  expect(await roomByCode(harness.db, room.code)).toBeNull();
  expect(await insertRoom(harness.db, aRoom())).toBe("ok");
});

test("deleteExpiredRooms removes only rows past the TTL and returns them", async () => {
  const TTL = 24 * 60 * 60 * 1000;
  const now = TTL * 3;
  const dead = aRoom({ id: roomId("room-dead"), code: roomCode("GAJUDIRU"), now: now - TTL });
  const alive = aRoom({ id: roomId("room-alive"), code: roomCode("BAJUDIRU"), now: now - TTL + 1 });
  await insertRoom(harness.db, dead);
  await insertRoom(harness.db, alive);

  expect(await deleteExpiredRooms(harness.db, now)).toBe(1);
  expect(await roomByCode(harness.db, dead.code)).toBeNull();
  expect((await roomByCode(harness.db, alive.code))!.room).toEqual(alive);

  expect(await deleteExpiredRooms(harness.db, now)).toBe(0);
});

test("removeRoomIf deletes only on a matching revision", async () => {
  const room = aRoom();
  await insertRoom(harness.db, room);

  expect(await removeRoomIf(harness.db, room.id, 1)).toBe(false);
  expect(await removeRoomIf(harness.db, room.id, 0)).toBe(true);
  expect(await roomByCode(harness.db, room.code)).toBeNull();
  expect(await removeRoomIf(harness.db, room.id, 0)).toBe(false);
});
