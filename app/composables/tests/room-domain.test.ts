import { expect, test } from "vitest";
import { roomCode, userId, type RoomCode, type UserId } from "../../../shared/rooms/ids.ts";
import {
  keepLastGood,
  lobbyOf,
  parseRoom,
  roomErrorKind,
  type Room,
  type RoomLoad,
} from "../room-domain.ts";

const CODE: RoomCode = roomCode("BAVOKUTI");
const HOST: UserId = userId("user-host");
const GUEST: UserId = userId("user-guest");

const wireRoom = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "room-1",
  code: "BAVOKUTI",
  link: "https://example.test/join/BAVOKUTI",
  host: "user-host",
  name: "New room",
  setup: { roles: ["banker", "director", "guerrilla", "politician", "peacekeeper"] },
  seats: [
    { id: "seat-0", occupant: "user-host", joinedAt: 1 },
    { id: "seat-1", occupant: null, joinedAt: null },
  ],
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const loadedRoom = (seats: readonly { id: string; occupant: string | null; joinedAt: number | null }[]): Room => ({
  code: CODE,
  name: "New room",
  host: HOST,
  link: "https://example.test/join/BAVOKUTI",
  roles: ["banker", "director", "guerrilla", "politician", "peacekeeper"],
  seats: seats.map((seat) => ({
    id: seat.id,
    occupant: seat.occupant === null ? null : userId(seat.occupant),
    joinedAt: seat.joinedAt,
  })),
});

test("parseRoom reads a valid wire object", () => {
  const room = parseRoom(wireRoom());
  expect(room).not.toBeNull();
  expect(room?.code).toBe("BAVOKUTI");
  expect(room?.host).toBe("user-host");
  expect(room?.roles).toEqual(["banker", "director", "guerrilla", "politician", "peacekeeper"]);
  expect(room?.seats).toEqual([
    { id: "seat-0", occupant: "user-host", joinedAt: 1 },
    { id: "seat-1", occupant: null, joinedAt: null },
  ]);
});

test("parseRoom drops unknown role ids and keeps the known ones", () => {
  const room = parseRoom(wireRoom({ setup: { roles: ["banker", "not-a-role", "director"] } }));
  expect(room?.roles).toEqual(["banker", "director"]);
});

test("parseRoom returns null on a missing or malformed code", () => {
  expect(parseRoom(wireRoom({ code: undefined }))).toBeNull();
  expect(parseRoom(wireRoom({ code: "nope" }))).toBeNull();
  expect(parseRoom(wireRoom({ code: 42 }))).toBeNull();
});

test("parseRoom returns null when seats is not an array or a seat is malformed", () => {
  expect(parseRoom(wireRoom({ seats: "seats" }))).toBeNull();
  expect(parseRoom(wireRoom({ seats: [{ id: "seat-0", occupant: 5, joinedAt: 1 }] }))).toBeNull();
  expect(parseRoom(wireRoom({ seats: [{ id: "", occupant: null, joinedAt: null }] }))).toBeNull();
});

test("parseRoom returns null on a malformed host, name, link, or roles container", () => {
  expect(parseRoom(wireRoom({ host: "" }))).toBeNull();
  expect(parseRoom(wireRoom({ name: 1 }))).toBeNull();
  expect(parseRoom(wireRoom({ link: null }))).toBeNull();
  expect(parseRoom(wireRoom({ setup: { roles: "roles" } }))).toBeNull();
  expect(parseRoom(null)).toBeNull();
  expect(parseRoom("room")).toBeNull();
});

test("roomErrorKind reads the Hono error body and ignores a plain error", () => {
  expect(roomErrorKind({ data: { error: { kind: "not-found" } } })).toBe("not-found");
  expect(roomErrorKind(new Error("boom"))).toBeNull();
  expect(roomErrorKind({ data: {} })).toBeNull();
  expect(roomErrorKind(undefined)).toBeNull();
});

test("lobbyOf reports waiting when a seat is open and full when every seat is taken", () => {
  const waiting = lobbyOf(
    { kind: "loaded", room: loadedRoom([
      { id: "seat-0", occupant: "user-host", joinedAt: 1 },
      { id: "seat-1", occupant: null, joinedAt: null },
    ]) },
    HOST,
  );
  expect(waiting.kind).toBe("room");
  if (waiting.kind !== "room") throw new Error("expected room");
  expect(waiting.status).toEqual({ kind: "waiting", filled: 1, total: 2 });
  expect(waiting.amIHost).toBe(true);
  expect(waiting.amISeated).toBe(true);
  expect(waiting.canStart).toBe(false);

  const full = lobbyOf(
    { kind: "loaded", room: loadedRoom([
      { id: "seat-0", occupant: "user-host", joinedAt: 1 },
      { id: "seat-1", occupant: "user-guest", joinedAt: 2 },
    ]) },
    HOST,
  );
  if (full.kind !== "room") throw new Error("expected room");
  expect(full.status).toEqual({ kind: "full", filled: 2, total: 2 });
  expect(full.canStart).toBe(true);
});

test("lobbyOf detects the host by occupant equality, not by seat index", () => {
  const lobby = lobbyOf(
    { kind: "loaded", room: loadedRoom([
      { id: "seat-0", occupant: "user-guest", joinedAt: 1 },
      { id: "seat-1", occupant: "user-host", joinedAt: 2 },
    ]) },
    HOST,
  );
  if (lobby.kind !== "room") throw new Error("expected room");
  expect(lobby.seats.map((seat) => seat.isHost)).toEqual([false, true]);
  expect(lobby.seats.map((seat) => seat.isMe)).toEqual([false, true]);
  expect(lobby.amIHost).toBe(true);
  expect(lobby.amISeated).toBe(true);
});

test("lobbyOf marks a non-seated viewer and never lets them start", () => {
  const lobby = lobbyOf(
    { kind: "loaded", room: loadedRoom([
      { id: "seat-0", occupant: "user-host", joinedAt: 1 },
      { id: "seat-1", occupant: "user-guest", joinedAt: 2 },
    ]) },
    userId("user-stranger"),
  );
  if (lobby.kind !== "room") throw new Error("expected room");
  expect(lobby.amISeated).toBe(false);
  expect(lobby.amIHost).toBe(false);
  expect(lobby.canStart).toBe(false);
  expect(lobby.seats.every((seat) => !seat.isMe)).toBe(true);
});

test("lobbyOf treats a null viewer as anonymous", () => {
  const lobby = lobbyOf(
    { kind: "loaded", room: loadedRoom([{ id: "seat-0", occupant: "user-host", joinedAt: 1 }]) },
    null,
  );
  if (lobby.kind !== "room") throw new Error("expected room");
  expect(lobby.amIHost).toBe(false);
  expect(lobby.amISeated).toBe(false);
});

test("lobbyOf passes the non-loaded arms through unchanged", () => {
  const arms: readonly RoomLoad[] = [
    { kind: "loading" },
    { kind: "invalid" },
    { kind: "missing" },
    { kind: "failed", reason: "network down" },
  ];
  for (const arm of arms) {
    expect(lobbyOf(arm, HOST)).toEqual(arm);
  }
});

test("keepLastGood keeps the last loaded room across a failed refetch", () => {
  const loaded: RoomLoad = { kind: "loaded", room: loadedRoom([]) };
  expect(keepLastGood(loaded, { kind: "failed", reason: "boom" })).toBe(loaded);
  expect(keepLastGood(loaded, { kind: "missing" })).toEqual({ kind: "missing" });
  expect(keepLastGood({ kind: "loading" }, { kind: "failed", reason: "boom" })).toEqual({
    kind: "failed",
    reason: "boom",
  });
});
