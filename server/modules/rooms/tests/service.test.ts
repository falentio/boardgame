import { afterEach, beforeEach, expect, test } from "vitest";
import { STARTER_ROLES } from "../../../../shared/core/lockstep/games/g54/roles.ts";
import { makeRandom } from "../../../../shared/core/lockstep/hash.ts";
import { seed } from "../../../../shared/core/lockstep/ids.ts";
import type { RoomEntropy } from "../../../../shared/rooms/code.ts";
import { CONSONANTS, VOWELS, roomCode, roomId, userId } from "../../../../shared/rooms/ids.ts";
import { ROOM_TTL_MS } from "../../../../shared/rooms/room.ts";
import { user } from "../../../db/schema.ts";
import type { Db } from "../../../utils/db.ts";
import {
  createRoom,
  deleteRoom,
  getRoom,
  joinRoom,
  kickUser,
  leaveRoom,
  startRoom,
  updateRoom,
  type RoomDeps,
} from "../service.ts";
import { roomByCode } from "../store.ts";
import { createTestDb, type TestDb } from "./d1-harness.ts";
import { recordingEvents, throwingEvents, type RecordingEvents } from "./recording-events.ts";

const HOST = userId("user-host");
const GUEST = userId("user-guest");
const THIRD = userId("user-third");

let harness: TestDb;
let recorder: RecordingEvents;

beforeEach(async () => {
  harness = await createTestDb();
  recorder = recordingEvents();
  const people = [
    ["user-host", "host@example.com"],
    ["user-guest", "guest@example.com"],
    ["user-third", "third@example.com"],
  ] as const;
  for (const [id, email] of people) {
    await harness.db
      .insert(user)
      .values({
        id: userId(id),
        name: id,
        email,
        emailVerified: false,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      });
  }
});

afterEach(async () => {
  await harness.dispose();
});

const scriptedEntropy = (codes: readonly string[]): RoomEntropy => {
  const values: number[] = [];
  for (const code of codes) {
    for (let index = 0; index < code.length; index += 1) {
      const alphabet = index % 2 === 0 ? CONSONANTS : VOWELS;
      values.push(alphabet.indexOf(code[index]!));
    }
  }
  let cursor = 0;
  return {
    int: (maxExclusive) => {
      const value = values[cursor];
      cursor += 1;
      if (value === undefined || value >= maxExclusive) {
        throw new Error("scripted entropy exhausted");
      }
      return value;
    },
  };
};

let idCounter = 0;

const deps = (overrides: Partial<RoomDeps> = {}): RoomDeps => ({
  db: harness.db,
  entropy: makeRandom(seed("00000000000000ff")),
  newId: () => roomId(`room-${String((idCounter += 1))}`),
  now: () => 1000,
  events: recorder.events,
  ...overrides,
});

const loseNextCas = (db: Db, count = 1): Db => {
  let remaining = count;
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === "update") {
        return (...args: unknown[]) => {
          if (remaining > 0) {
            remaining -= 1;
            return { set: () => ({ where: () => ({ returning: async () => [] }) }) };
          }
          return Reflect.apply(target.update, target, args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
};

const loseNextDelete = (db: Db, count = 1): Db => {
  let remaining = count;
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === "delete") {
        return (...args: unknown[]) => {
          if (remaining > 0) {
            remaining -= 1;
            return { where: () => ({ returning: async () => [] }) };
          }
          return Reflect.apply(target.delete, target, args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
};

test("createRoom persists a room the service reads back by code", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  expect(created.value.name).toBe("Alpha");
  expect(created.value.host).toBe(HOST);

  const fetched = await getRoom(deps(), created.value.code);
  expect(fetched.ok && fetched.value).toEqual(created.value);
});

test("getRoom reports not-found for an unknown code", async () => {
  const fetched = await getRoom(deps(), roomCode("BAKUDIRU"));
  expect(fetched).toEqual({ ok: false, error: { kind: "not-found" } });
});

test("createRoom retries a code collision and lands on a free code", async () => {
  const first = await createRoom(deps({ entropy: scriptedEntropy(["GAKUDIRU"]) }), {
    host: HOST,
    name: "Alpha",
    seats: 3,
    roles: STARTER_ROLES,
  });
  if (!first.ok) throw new Error(`expected a room, got ${first.error.kind}`);
  expect(first.value.code).toBe("GAKUDIRU");

  const second = await createRoom(deps({ entropy: scriptedEntropy(["GAKUDIRU", "BAKUDIRU"]) }), {
    host: HOST,
    name: "Beta",
    seats: 3,
    roles: STARTER_ROLES,
  });
  if (!second.ok) throw new Error(`expected a retry to succeed, got ${second.error.kind}`);
  expect(second.value.code).toBe("BAKUDIRU");
});

test("joinRoom seats a second user in the first open seat", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);

  const joined = await joinRoom(deps(), { code: created.value.code, user: GUEST });
  if (!joined.ok) throw new Error(`expected a join, got ${joined.error.kind}`);
  expect(joined.value.seats[1]!.occupant).toBe(GUEST);

  const reloaded = await getRoom(deps(), created.value.code);
  expect(reloaded.ok && reloaded.value.seats[1]!.occupant).toBe(GUEST);
});

test("joinRoom reports not-found for an unknown code", async () => {
  const joined = await joinRoom(deps(), { code: roomCode("BAKUDIRU"), user: GUEST });
  expect(joined).toEqual({ ok: false, error: { kind: "not-found" } });
});

test("joinRoom refuses a repeat join and a full room", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 2, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);

  const repeat = await joinRoom(deps(), { code: created.value.code, user: HOST });
  expect(repeat).toEqual({ ok: false, error: { kind: "already-seated" } });

  const guest = await joinRoom(deps(), { code: created.value.code, user: GUEST });
  if (!guest.ok) throw new Error(`expected a join, got ${guest.error.kind}`);

  const third = await joinRoom(deps(), { code: created.value.code, user: THIRD });
  expect(third).toEqual({ ok: false, error: { kind: "room-full" } });
});

test("updateRoom renames and sets roles for the host", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);

  const roles = ["capitalist", "newscaster", "general", "lawyer", "priest"] as const;
  const updated = await updateRoom(deps(), {
    code: created.value.code,
    actor: HOST,
    name: "Beta",
    roles,
  });
  if (!updated.ok) throw new Error(`expected an update, got ${updated.error.kind}`);
  expect(updated.value.name).toBe("Beta");
  expect(updated.value.setup.roles).toEqual(roles);

  const reloaded = await getRoom(deps(), created.value.code);
  expect(reloaded.ok && reloaded.value.name).toBe("Beta");
});

test("updateRoom refuses a non-host and an unknown code", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);

  const denied = await updateRoom(deps(), { code: created.value.code, actor: GUEST, name: "Beta" });
  expect(denied).toEqual({ ok: false, error: { kind: "not-host" } });

  const missing = await updateRoom(deps(), { code: roomCode("BAKUDIRU"), actor: HOST, name: "Beta" });
  expect(missing).toEqual({ ok: false, error: { kind: "not-found" } });
});

test("deleteRoom removes the room for the host and refuses others", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);

  const denied = await deleteRoom(deps(), { code: created.value.code, actor: GUEST });
  expect(denied).toEqual({ ok: false, error: { kind: "not-host" } });

  const removed = await deleteRoom(deps(), { code: created.value.code, actor: HOST });
  expect(removed.ok).toBe(true);

  const fetched = await getRoom(deps(), created.value.code);
  expect(fetched).toEqual({ ok: false, error: { kind: "not-found" } });
});

test("joinRoom survives a lost compare-and-swap by reloading and retrying", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);

  const joined = await joinRoom(deps({ db: loseNextCas(harness.db) }), {
    code: created.value.code,
    user: GUEST,
  });
  if (!joined.ok) throw new Error(`expected the retry to succeed, got ${joined.error.kind}`);
  expect(joined.value.seats[1]!.occupant).toBe(GUEST);

  const reloaded = await getRoom(deps(), created.value.code);
  expect(reloaded.ok && reloaded.value.seats[1]!.occupant).toBe(GUEST);
});

test("joinRoom reports conflict when the compare-and-swap retries are exhausted", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);

  const joined = await joinRoom(deps({ db: loseNextCas(harness.db, 5) }), {
    code: created.value.code,
    user: GUEST,
  });
  expect(joined).toEqual({ ok: false, error: { kind: "conflict" } });
});

test("createRoom emits one room-changed with reason created", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);

  expect(recorder.changes).toHaveLength(1);
  expect(recorder.changes[0]!.reason).toBe("created");
  expect(recorder.changes[0]!.room).toEqual(created.value);
});

test("joinRoom emits one room-changed with reason joined", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  recorder.changes.length = 0;

  const joined = await joinRoom(deps(), { code: created.value.code, user: GUEST });
  if (!joined.ok) throw new Error(`expected a join, got ${joined.error.kind}`);

  expect(recorder.changes).toHaveLength(1);
  expect(recorder.changes[0]!.reason).toBe("joined");
  expect(recorder.changes[0]!.room).toEqual(joined.value);
});

test("updateRoom emits one room-changed with reason updated", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  recorder.changes.length = 0;

  const updated = await updateRoom(deps(), { code: created.value.code, actor: HOST, name: "Beta" });
  if (!updated.ok) throw new Error(`expected an update, got ${updated.error.kind}`);

  expect(recorder.changes).toHaveLength(1);
  expect(recorder.changes[0]!.reason).toBe("updated");
  expect(recorder.changes[0]!.room).toEqual(updated.value);
});

test("deleteRoom emits one room-changed with reason deleted", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  recorder.changes.length = 0;

  const removed = await deleteRoom(deps(), { code: created.value.code, actor: HOST });
  expect(removed.ok).toBe(true);

  expect(recorder.changes).toHaveLength(1);
  expect(recorder.changes[0]!.reason).toBe("deleted");
  expect(recorder.changes[0]!.room.code).toBe(created.value.code);
});

test("no emit fires on an error path: not-found, denied, already-seated, room-full", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 1, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  recorder.changes.length = 0;

  await joinRoom(deps(), { code: roomCode("BAKUDIRU"), user: GUEST });
  await joinRoom(deps(), { code: created.value.code, user: HOST });
  await joinRoom(deps(), { code: created.value.code, user: GUEST });
  await updateRoom(deps(), { code: created.value.code, actor: GUEST, name: "Beta" });
  await deleteRoom(deps(), { code: created.value.code, actor: GUEST });

  expect(recorder.changes).toEqual([]);
});

test("a lost compare-and-swap emits exactly once, after the retry lands", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  recorder.changes.length = 0;

  const joined = await joinRoom(deps({ db: loseNextCas(harness.db) }), {
    code: created.value.code,
    user: GUEST,
  });
  if (!joined.ok) throw new Error(`expected the retry to succeed, got ${joined.error.kind}`);

  expect(recorder.changes).toHaveLength(1);
  expect(recorder.changes[0]!.reason).toBe("joined");
});

test("a thrown events.changed does not fail the mutation", async () => {
  const created = await createRoom(deps({ events: throwingEvents(new Error("transport down")) }), {
    host: HOST,
    name: "Alpha",
    seats: 3,
    roles: STARTER_ROLES,
  });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);

  const joined = await joinRoom(deps({ events: throwingEvents(new Error("transport down")) }), {
    code: created.value.code,
    user: GUEST,
  });
  expect(joined.ok).toBe(true);

  const reloaded = await getRoom(deps(), created.value.code);
  expect(reloaded.ok && reloaded.value.seats[1]!.occupant).toBe(GUEST);
});

test("leaveRoom frees the seat and emits one updated", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  await joinRoom(deps(), { code: created.value.code, user: GUEST });
  recorder.changes.length = 0;

  const left = await leaveRoom(deps(), { code: created.value.code, user: GUEST });
  if (!left.ok) throw new Error(`expected a leave, got ${left.error.kind}`);
  if (left.value === null) throw new Error("expected a surviving room");
  expect(left.value.seats[1]!.occupant).toBeNull();
  expect(recorder.changes).toHaveLength(1);
  expect(recorder.changes[0]!.reason).toBe("updated");

  const reloaded = await getRoom(deps(), created.value.code);
  expect(reloaded.ok && reloaded.value.seats[1]!.occupant).toBeNull();
});

test("kickUser frees the target's seat and emits one updated", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  await joinRoom(deps(), { code: created.value.code, user: GUEST });
  recorder.changes.length = 0;

  const kicked = await kickUser(deps(), {
    code: created.value.code,
    actor: HOST,
    target: GUEST,
  });
  if (!kicked.ok) throw new Error(`expected a kick, got ${kicked.error.kind}`);
  if (kicked.value === null) throw new Error("expected a surviving room");
  expect(kicked.value.seats[1]!.occupant).toBeNull();
  expect(recorder.changes).toHaveLength(1);
  expect(recorder.changes[0]!.reason).toBe("updated");
});

test("startRoom stamps startedAt, persists it, and emits one updated", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 2, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  await joinRoom(deps(), { code: created.value.code, user: GUEST });
  recorder.changes.length = 0;

  const started = await startRoom(deps({ now: () => 5000 }), {
    code: created.value.code,
    actor: HOST,
  });
  if (!started.ok) throw new Error(`expected a start, got ${started.error.kind}`);
  expect(started.value.startedAt).toBe(5000);
  expect(recorder.changes).toHaveLength(1);
  expect(recorder.changes[0]!.reason).toBe("updated");

  const reloaded = await getRoom(deps(), created.value.code);
  expect(reloaded.ok && reloaded.value.startedAt).toBe(5000);
});

test("startRoom refuses a non-host and an open room", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 2, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);

  const open = await startRoom(deps(), { code: created.value.code, actor: HOST });
  expect(open).toEqual({ ok: false, error: { kind: "room-not-full" } });

  await joinRoom(deps(), { code: created.value.code, user: GUEST });
  const denied = await startRoom(deps(), { code: created.value.code, actor: GUEST });
  expect(denied).toEqual({ ok: false, error: { kind: "not-host" } });
});

test("a repeated start is idempotent: the first moment survives and nothing churns", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 2, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  await joinRoom(deps(), { code: created.value.code, user: GUEST });

  const first = await startRoom(deps({ now: () => 5000 }), {
    code: created.value.code,
    actor: HOST,
  });
  if (!first.ok) throw new Error(`expected a start, got ${first.error.kind}`);
  recorder.changes.length = 0;

  const again = await startRoom(deps({ now: () => 9000 }), {
    code: created.value.code,
    actor: HOST,
  });
  if (!again.ok) throw new Error(`expected a repeat start, got ${again.error.kind}`);
  expect(again.value.startedAt).toBe(5000);
  expect(again.value.updatedAt).toBe(5000);
  expect(recorder.changes).toEqual([]);
});

test("joinRoom refuses a room the host has started", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 2, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  await joinRoom(deps(), { code: created.value.code, user: GUEST });
  await startRoom(deps(), { code: created.value.code, actor: HOST });

  const late = await joinRoom(deps(), { code: created.value.code, user: THIRD });
  expect(late).toEqual({ ok: false, error: { kind: "already-started" } });
});

test("a started room refuses leave and kick, so its roster stays full", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 2, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  await joinRoom(deps(), { code: created.value.code, user: GUEST });
  await startRoom(deps(), { code: created.value.code, actor: HOST });
  recorder.changes.length = 0;

  expect(await leaveRoom(deps(), { code: created.value.code, user: HOST })).toEqual({
    ok: false,
    error: { kind: "already-started" },
  });
  expect(
    await kickUser(deps(), { code: created.value.code, actor: HOST, target: GUEST }),
  ).toEqual({ ok: false, error: { kind: "already-started" } });
  expect(recorder.changes).toEqual([]);

  const reloaded = await getRoom(deps(), created.value.code);
  expect(reloaded.ok && reloaded.value.startedAt).not.toBeNull();
  expect(reloaded.ok && reloaded.value.seats.every((seat) => seat.occupant !== null)).toBe(true);
});

test("a start that loses the compare-and-swap retries and keeps the first moment", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 2, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  await joinRoom(deps(), { code: created.value.code, user: GUEST });
  const first = await startRoom(deps({ now: () => 5000 }), { code: created.value.code, actor: HOST });
  if (!first.ok) throw new Error(`expected a start, got ${first.error.kind}`);

  const retried = await startRoom(deps({ db: loseNextCas(harness.db), now: () => 9000 }), {
    code: created.value.code,
    actor: HOST,
  });
  if (!retried.ok) throw new Error(`expected the retry to succeed, got ${retried.error.kind}`);
  expect(retried.value.startedAt).toBe(5000);
});

test("updateRoom with no fields writes nothing and emits nothing", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  recorder.changes.length = 0;

  const updated = await updateRoom(deps(), { code: created.value.code, actor: HOST });
  if (!updated.ok) throw new Error(`expected an update, got ${updated.error.kind}`);
  expect(updated.value.name).toBe("Alpha");
  expect(recorder.changes).toEqual([]);
});

test("the last occupant leaving deletes the row, frees the code, and emits one deleted", async () => {
  const created = await createRoom(deps({ entropy: scriptedEntropy(["GAKUDIRU"]) }), {
    host: HOST,
    name: "Alpha",
    seats: 1,
    roles: STARTER_ROLES,
  });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  recorder.changes.length = 0;

  const left = await leaveRoom(deps(), { code: created.value.code, user: HOST });
  expect(left).toEqual({ ok: true, value: null });
  expect(await roomByCode(harness.db, created.value.code)).toBeNull();
  expect(recorder.changes).toHaveLength(1);
  expect(recorder.changes[0]!.reason).toBe("deleted");

  const reclaimed = await createRoom(deps({ entropy: scriptedEntropy(["GAKUDIRU"]) }), {
    host: HOST,
    name: "Beta",
    seats: 1,
    roles: STARTER_ROLES,
  });
  if (!reclaimed.ok) throw new Error(`expected the code to be free, got ${reclaimed.error.kind}`);
  expect(reclaimed.value.code).toBe("GAKUDIRU");
});

test("leave reloads and retries when the delete loses the compare-and-swap", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 1, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  recorder.changes.length = 0;

  const left = await leaveRoom(deps({ db: loseNextDelete(harness.db) }), {
    code: created.value.code,
    user: HOST,
  });
  expect(left).toEqual({ ok: true, value: null });
  expect(await roomByCode(harness.db, created.value.code)).toBeNull();
  expect(recorder.changes).toHaveLength(1);
  expect(recorder.changes[0]!.reason).toBe("deleted");
});

test("an expired room reads as not-found and refuses joins", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  const expired = deps({ now: () => 1000 + ROOM_TTL_MS });

  expect(await getRoom(expired, created.value.code)).toEqual({
    ok: false,
    error: { kind: "not-found" },
  });
  expect(await joinRoom(expired, { code: created.value.code, user: GUEST })).toEqual({
    ok: false,
    error: { kind: "not-found" },
  });
});

test("createRoom reclaims an expired code before it inserts", async () => {
  const first = await createRoom(deps({ entropy: scriptedEntropy(["GAKUDIRU"]) }), {
    host: HOST,
    name: "Alpha",
    seats: 3,
    roles: STARTER_ROLES,
  });
  if (!first.ok) throw new Error(`expected a room, got ${first.error.kind}`);

  const second = await createRoom(
    deps({ entropy: scriptedEntropy(["GAKUDIRU"]), now: () => 1000 + ROOM_TTL_MS }),
    { host: HOST, name: "Beta", seats: 3, roles: STARTER_ROLES },
  );
  if (!second.ok) throw new Error(`expected the code to be reclaimed, got ${second.error.kind}`);
  expect(second.value.code).toBe("GAKUDIRU");
  expect(second.value.id).not.toBe(first.value.id);
  expect((await roomByCode(harness.db, second.value.code))!.room.id).toBe(second.value.id);
});

test("leave and kick emit nothing on their error paths", async () => {
  const created = await createRoom(deps(), { host: HOST, name: "Alpha", seats: 3, roles: STARTER_ROLES });
  if (!created.ok) throw new Error(`expected a room, got ${created.error.kind}`);
  recorder.changes.length = 0;

  expect(await leaveRoom(deps(), { code: created.value.code, user: GUEST })).toEqual({
    ok: false,
    error: { kind: "not-seated" },
  });
  expect(
    await kickUser(deps(), { code: created.value.code, actor: GUEST, target: HOST }),
  ).toEqual({ ok: false, error: { kind: "not-host" } });
  expect(
    await kickUser(deps(), { code: created.value.code, actor: HOST, target: GUEST }),
  ).toEqual({ ok: false, error: { kind: "not-seated" } });
  expect(await leaveRoom(deps(), { code: roomCode("BAKUDIRU"), user: GUEST })).toEqual({
    ok: false,
    error: { kind: "not-found" },
  });

  expect(recorder.changes).toEqual([]);
});
