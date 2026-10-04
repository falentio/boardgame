import { afterEach, beforeEach, expect, test } from "vitest";
import { STARTER_ROLES } from "../../../../shared/core/lockstep/games/g54/roles.ts";
import { makeRandom } from "../../../../shared/core/lockstep/hash.ts";
import { seed } from "../../../../shared/core/lockstep/ids.ts";
import { CONSONANTS, VOWELS, type RoomEntropy } from "../../../../shared/rooms/code.ts";
import { roomCode, roomId, userId } from "../../../../shared/rooms/ids.ts";
import { user } from "../../../db/schema.ts";
import type { Db } from "../../../utils/db.ts";
import {
  createRoom,
  deleteRoom,
  getRoom,
  joinRoom,
  updateRoom,
  type RoomDeps,
} from "../service.ts";
import { createTestDb, type TestDb } from "./d1-harness.ts";

const HOST = userId("user-host");
const GUEST = userId("user-guest");
const THIRD = userId("user-third");

let harness: TestDb;

beforeEach(async () => {
  harness = await createTestDb();
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
