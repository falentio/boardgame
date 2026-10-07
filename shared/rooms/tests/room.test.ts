import { expect, test } from "vitest";
import { makeRoster } from "../../core/lockstep/frame.ts";
import type { G54Setup } from "../../core/lockstep/games/g54/setup.ts";
import { STARTER_ROLES } from "../../core/lockstep/games/g54/roles.ts";
import { roomCode, roomId, userId, type UserId } from "../ids.ts";
import {
  MAX_NAME_LENGTH,
  ROOM_TTL_MS,
  createRoom,
  isExpired,
  joinRoom,
  kickFromRoom,
  leaveRoom,
  renameRoom,
  requireHost,
  setRoles,
  type NewRoom,
  type Room,
  type RoomError,
} from "../room.ts";

const HOST = userId("user-host");
const GUEST = userId("user-guest");
const THIRD = userId("user-third");
const SETUP: G54Setup = { roles: STARTER_ROLES };

const newRoom = (overrides: Partial<NewRoom> = {}): NewRoom => ({
  id: roomId("room-1"),
  code: roomCode("GAKUDIRU"),
  host: HOST,
  name: "Alpha",
  seats: 3,
  setup: SETUP,
  now: 1000,
  ...overrides,
});

const created = (overrides: Partial<NewRoom> = {}): Room => {
  const result = createRoom(newRoom(overrides));
  if (!result.ok) throw new Error(`expected a room, got ${result.error.kind}`);
  return result.value;
};

const failure = <T>(result: { ok: true; value: T } | { ok: false; error: RoomError }): RoomError => {
  if (result.ok) throw new Error("expected a failure");
  return result.error;
};

test("createRoom seats the host at position 0 and opens the rest", () => {
  const room = created();
  expect(room.id).toBe("room-1");
  expect(room.code).toBe("GAKUDIRU");
  expect(room.host).toBe(HOST);
  expect(room.name).toBe("Alpha");
  expect(room.setup).toEqual(SETUP);
  expect(room.seats).toHaveLength(3);
  expect(room.seats[0]).toEqual({ id: room.seats[0]!.id, occupant: HOST, joinedAt: 1000 });
  for (const seat of room.seats.slice(1)) {
    expect(seat.occupant).toBeNull();
    expect(seat.joinedAt).toBeNull();
  }
  expect(room.createdAt).toBe(1000);
  expect(room.updatedAt).toBe(1000);
});

test("createRoom derives unique non-empty seat ids the engine roster accepts", () => {
  const room = created({ seats: 7 });
  const ids = room.seats.map((seat) => seat.id);
  expect(new Set(ids).size).toBe(7);
  for (const id of ids) expect(id.length).toBeGreaterThan(0);
  expect(() => makeRoster(ids)).not.toThrow();
});

test("createRoom trims the name and rejects empty or over-long names", () => {
  expect(created({ name: "  spaced  " }).name).toBe("spaced");
  expect(failure(createRoom(newRoom({ name: "   " })))).toEqual({
    kind: "invalid-name",
    reason: expect.any(String),
  });
  expect(failure(createRoom(newRoom({ name: "" }))).kind).toBe("invalid-name");
  expect(failure(createRoom(newRoom({ name: "x".repeat(MAX_NAME_LENGTH + 1) }))).kind).toBe(
    "invalid-name",
  );
  expect(created({ name: "x".repeat(MAX_NAME_LENGTH) }).name).toHaveLength(MAX_NAME_LENGTH);
});

test("createRoom rejects seat counts outside 1..7 and non-integers", () => {
  for (const seats of [0, 8, -1, 3.5]) {
    expect(failure(createRoom(newRoom({ seats }))).kind).toBe("invalid-seat-count");
  }
  expect(createRoom(newRoom({ seats: 1 })).ok).toBe(true);
  expect(createRoom(newRoom({ seats: 7 })).ok).toBe(true);
});

test("createRoom rejects an invalid role selection as invalid-setup", () => {
  const bad = { roles: ["banker", "director", "guerrilla", "politician"] } as unknown as G54Setup;
  const result = createRoom(newRoom({ setup: bad }));
  expect(failure(result)).toEqual({ kind: "invalid-setup", reason: expect.any(String) });
});

test("joinRoom fills the first open seat and stamps the join time", () => {
  const room = created();
  const joined = joinRoom(room, { user: GUEST, now: 2000 });
  if (!joined.ok) throw new Error("expected a join");
  expect(joined.value.seats[1]).toEqual({
    id: room.seats[1]!.id,
    occupant: GUEST,
    joinedAt: 2000,
  });
  expect(joined.value.seats[2]!.occupant).toBeNull();
  expect(joined.value.updatedAt).toBe(2000);
  expect(joined.value.createdAt).toBe(1000);
});

test("joinRoom refuses a repeat join and a full room", () => {
  const room = created({ seats: 2 });
  expect(failure(joinRoom(room, { user: HOST, now: 2000 }))).toEqual({ kind: "already-seated" });

  const one = joinRoom(room, { user: GUEST, now: 2000 });
  if (!one.ok) throw new Error("expected a join");
  expect(failure(joinRoom(one.value, { user: THIRD, now: 3000 }))).toEqual({ kind: "room-full" });
  expect(failure(joinRoom(one.value, { user: GUEST, now: 3000 }))).toEqual({
    kind: "already-seated",
  });
});

test("renameRoom lets the host rename and moves updatedAt, not createdAt", () => {
  const room = created();
  const renamed = renameRoom(room, { actor: HOST, name: "  Beta  ", now: 5000 });
  if (!renamed.ok) throw new Error("expected a rename");
  expect(renamed.value.name).toBe("Beta");
  expect(renamed.value.updatedAt).toBe(5000);
  expect(renamed.value.createdAt).toBe(1000);
});

test("renameRoom refuses a non-host and an invalid name", () => {
  const room = created();
  expect(failure(renameRoom(room, { actor: GUEST, name: "Beta", now: 5000 }))).toEqual({
    kind: "not-host",
  });
  expect(failure(renameRoom(room, { actor: HOST, name: "  ", now: 5000 })).kind).toBe(
    "invalid-name",
  );
});

test("setRoles replaces the setup for the host and validates the selection", () => {
  const room = created();
  const roles = ["capitalist", "newscaster", "general", "lawyer", "priest"] as const;
  const updated = setRoles(room, { actor: HOST, roles, now: 6000 });
  if (!updated.ok) throw new Error("expected a role update");
  expect(updated.value.setup.roles).toEqual(roles);
  expect(updated.value.updatedAt).toBe(6000);

  expect(failure(setRoles(room, { actor: GUEST, roles, now: 6000 })).kind).toBe("not-host");
  const bad = ["banker", "director", "guerrilla", "politician"] as const;
  expect(failure(setRoles(room, { actor: HOST, roles: bad, now: 6000 })).kind).toBe(
    "invalid-setup",
  );
});

test("requireHost accepts the host and rejects everyone else", () => {
  const room = created();
  expect(requireHost(room, HOST)).toBeNull();
  expect(requireHost(room, GUEST)).toEqual({ kind: "not-host" });
});

test("transitions are pure: inputs are untouched and equal inputs give equal outputs", () => {
  const room = created();
  const before = JSON.parse(JSON.stringify(room)) as Room;
  const first = joinRoom(room, { user: GUEST, now: 2000 });
  const second = joinRoom(room, { user: GUEST, now: 2000 });
  expect(room).toEqual(before);
  expect(first).toEqual(second);
  expect(first.ok && first.value).not.toBe(room);
});

test("isExpired treats the TTL boundary as expired", () => {
  const room = created({ now: 1000 });
  expect(isExpired(room, 1000 + ROOM_TTL_MS - 1)).toBe(false);
  expect(isExpired(room, 1000 + ROOM_TTL_MS)).toBe(true);
});

const withGuests = (guests: readonly UserId[]): Room => {
  let room = created();
  for (const guest of guests) {
    const joined = joinRoom(room, { user: guest, now: 2000 });
    if (!joined.ok) throw new Error(`expected a join, got ${joined.error.kind}`);
    room = joined.value;
  }
  return room;
};

test("leaveRoom frees the leaver's seat and leaves the host in place", () => {
  const room = withGuests([GUEST]);
  const left = leaveRoom(room, { actor: GUEST, now: 3000 });
  if (!left.ok) throw new Error("expected a departure");
  if (left.value.kind !== "room") throw new Error("expected a surviving room");
  expect(left.value.room.host).toBe(HOST);
  expect(left.value.room.seats[1]).toEqual({
    id: room.seats[1]!.id,
    occupant: null,
    joinedAt: null,
  });
  expect(left.value.room.seats[0]!.occupant).toBe(HOST);
  expect(left.value.room.updatedAt).toBe(3000);
});

test("leaveRoom reports not-seated for a non-occupant", () => {
  expect(failure(leaveRoom(created(), { actor: GUEST, now: 3000 }))).toEqual({
    kind: "not-seated",
  });
});

test("leaveRoom transfers host to the lowest-index remaining occupant", () => {
  const room = withGuests([GUEST, THIRD]);
  const left = leaveRoom(room, { actor: HOST, now: 3000 });
  if (!left.ok) throw new Error("expected a departure");
  if (left.value.kind !== "room") throw new Error("expected a surviving room");
  expect(left.value.room.host).toBe(GUEST);
  expect(left.value.room.seats.map((seat) => seat.occupant)).toEqual([null, GUEST, THIRD]);
});

test("leaveRoom by the last occupant dissolves the room", () => {
  const left = leaveRoom(created({ seats: 1 }), { actor: HOST, now: 3000 });
  if (!left.ok) throw new Error("expected a departure");
  expect(left.value).toEqual({ kind: "empty" });
});

test("kickFromRoom frees the target's seat and keeps the host", () => {
  const room = withGuests([GUEST]);
  const kicked = kickFromRoom(room, { actor: HOST, target: GUEST, now: 3000 });
  if (!kicked.ok) throw new Error("expected a departure");
  if (kicked.value.kind !== "room") throw new Error("expected a surviving room");
  expect(kicked.value.room.host).toBe(HOST);
  expect(kicked.value.room.seats[1]!.occupant).toBeNull();
  expect(kicked.value.room.seats[1]!.joinedAt).toBeNull();
});

test("kickFromRoom refuses a non-host, a self-kick, and a non-occupant", () => {
  const room = withGuests([GUEST]);
  expect(failure(kickFromRoom(room, { actor: GUEST, target: HOST, now: 3000 }))).toEqual({
    kind: "not-host",
  });
  expect(failure(kickFromRoom(room, { actor: HOST, target: HOST, now: 3000 }))).toEqual({
    kind: "invalid-kick",
    reason: expect.any(String),
  });
  expect(failure(kickFromRoom(room, { actor: HOST, target: THIRD, now: 3000 }))).toEqual({
    kind: "not-seated",
  });
});

test("leaveRoom and kickFromRoom are pure: inputs are untouched", () => {
  const room = withGuests([GUEST]);
  const before = JSON.parse(JSON.stringify(room)) as Room;
  const left = leaveRoom(room, { actor: GUEST, now: 3000 });
  const kicked = kickFromRoom(room, { actor: HOST, target: GUEST, now: 3000 });
  expect(room).toEqual(before);
  expect(left.ok && left.value).toEqual(kicked.ok && kicked.value);
});
