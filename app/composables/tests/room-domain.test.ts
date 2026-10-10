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

const CODE: RoomCode = roomCode("BAWOLUTI");
const HOST: UserId = userId("user-host");
const GUEST: UserId = userId("user-guest");

const wireRoom = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "room-1",
  code: "BAWOLUTI",
  link: "https://example.test/join/BAWOLUTI",
  host: "user-host",
  name: "New room",
  setup: { roles: ["banker", "director", "guerrilla", "politician", "peacekeeper"] },
  seats: [
    { id: "seat-0", occupant: "user-host", name: "Host Person", image: null, joinedAt: 1 },
    { id: "seat-1", occupant: null, name: null, image: null, joinedAt: null },
  ],
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

interface LoadedSeat {
  id: string;
  occupant: string | null;
  name?: string | null;
  image?: string | null;
  joinedAt: number | null;
}

const loadedRoom = (seats: readonly LoadedSeat[], startedAt: number | null = null): Room => ({
  code: CODE,
  name: "New room",
  host: HOST,
  link: "https://example.test/join/BAWOLUTI",
  roles: ["banker", "director", "guerrilla", "politician", "peacekeeper"],
  startedAt,
  expiresAt: 86_400_001,
  seats: seats.map((seat) => ({
    id: seat.id,
    occupant: seat.occupant === null ? null : userId(seat.occupant),
    name: seat.name ?? null,
    image: seat.image ?? null,
    joinedAt: seat.joinedAt,
  })),
});

test("parseRoom reads a valid wire object", () => {
  const room = parseRoom(wireRoom());
  expect(room).not.toBeNull();
  expect(room?.code).toBe("BAWOLUTI");
  expect(room?.host).toBe("user-host");
  expect(room?.roles).toEqual(["banker", "director", "guerrilla", "politician", "peacekeeper"]);
  expect(room?.seats).toEqual([
    { id: "seat-0", occupant: "user-host", name: "Host Person", image: null, joinedAt: 1 },
    { id: "seat-1", occupant: null, name: null, image: null, joinedAt: null },
  ]);
});

test("parseRoom degrades a malformed identity field to null without failing the load", () => {
  const room = parseRoom(
    wireRoom({
      seats: [
        { id: "seat-0", occupant: "user-host", name: 42, image: { url: "x" }, joinedAt: 1 },
        { id: "seat-1", occupant: null, name: null, image: null, joinedAt: null },
      ],
    }),
  );
  expect(room).not.toBeNull();
  expect(room?.seats[0]).toEqual({
    id: "seat-0",
    occupant: "user-host",
    name: null,
    image: null,
    joinedAt: 1,
  });
});

test("parseRoom degrades an absent identity field to null", () => {
  const room = parseRoom(
    wireRoom({ seats: [{ id: "seat-0", occupant: "user-host", joinedAt: 1 }] }),
  );
  expect(room?.seats[0]).toEqual({
    id: "seat-0",
    occupant: "user-host",
    name: null,
    image: null,
    joinedAt: 1,
  });
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

test("parseRoom reads startedAt and expiresAt leniently", () => {
  const started = parseRoom(wireRoom({ startedAt: 5000, expiresAt: 86_400_001 }));
  expect(started?.startedAt).toBe(5000);
  expect(started?.expiresAt).toBe(86_400_001);

  const lobby = parseRoom(wireRoom());
  expect(lobby?.startedAt).toBeNull();
  expect(lobby?.expiresAt).toBeNull();
});

test("parseRoom degrades a non-numeric startedAt or expiresAt to null without failing", () => {
  const room = parseRoom(wireRoom({ startedAt: "yes", expiresAt: { at: 1 } }));
  expect(room).not.toBeNull();
  expect(room?.startedAt).toBeNull();
  expect(room?.expiresAt).toBeNull();
});

test("lobbyOf derives started, canStart, canLeave, canKick, and gameRedirect", () => {
  const lobby = lobbyOf(
    { kind: "loaded", room: loadedRoom([
      { id: "seat-0", occupant: "user-host", joinedAt: 1 },
      { id: "seat-1", occupant: "user-guest", joinedAt: 2 },
    ], 5000) },
    HOST,
  );
  if (lobby.kind !== "room") throw new Error("expected room");
  expect(lobby.started).toBe(true);
  expect(lobby.canStart).toBe(false);
  expect(lobby.canLeave).toBe(false);
  expect(lobby.canKick).toBe(false);
  expect(lobby.gameRedirect).toBe(false);
  expect(lobby.expiresAt).toBe(86_400_001);
});

test("lobbyOf lets a seated non-host be redirected and the host kick before start", () => {
  const seats = [
    { id: "seat-0", occupant: "user-host", joinedAt: 1 },
    { id: "seat-1", occupant: "user-guest", joinedAt: 2 },
  ];
  const startedLobby = lobbyOf({ kind: "loaded", room: loadedRoom(seats, 5000) }, GUEST);
  if (startedLobby.kind !== "room") throw new Error("expected room");
  expect(startedLobby.gameRedirect).toBe(true);
  expect(startedLobby.canStart).toBe(false);

  const preStart = lobbyOf({ kind: "loaded", room: loadedRoom(seats) }, HOST);
  if (preStart.kind !== "room") throw new Error("expected room");
  expect(preStart.started).toBe(false);
  expect(preStart.canStart).toBe(true);
  expect(preStart.canKick).toBe(true);
  expect(preStart.canLeave).toBe(true);
  const [hostSeat, guestSeat] = preStart.seats;
  if (hostSeat === undefined || guestSeat === undefined) throw new Error("expected two seats");
  expect(hostSeat.occupant !== null && hostSeat.canKick).toBe(false);
  expect(guestSeat.occupant !== null && guestSeat.canKick).toBe(true);
});

test("lobbyOf never offers a non-host member the kick control", () => {
  const lobby = lobbyOf(
    { kind: "loaded", room: loadedRoom([
      { id: "seat-0", occupant: "user-host", joinedAt: 1 },
      { id: "seat-1", occupant: "user-guest", joinedAt: 2 },
    ]) },
    GUEST,
  );
  if (lobby.kind !== "room") throw new Error("expected room");
  expect(lobby.canKick).toBe(false);
  for (const seat of lobby.seats) {
    expect(seat.occupant === null || seat.canKick).toBe(false);
  }
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

test("lobbyOf lets the host start a sparse room once the minimum is seated", () => {
  const lobby = lobbyOf(
    { kind: "loaded", room: loadedRoom([
      { id: "seat-0", occupant: "user-host", joinedAt: 1 },
      { id: "seat-1", occupant: "user-guest", joinedAt: 2 },
      { id: "seat-2", occupant: null, joinedAt: null },
      { id: "seat-3", occupant: null, joinedAt: null },
      { id: "seat-4", occupant: null, joinedAt: null },
    ]) },
    HOST,
  );
  if (lobby.kind !== "room") throw new Error("expected room");
  expect(lobby.status).toEqual({ kind: "waiting", filled: 2, total: 5 });
  expect(lobby.canStart).toBe(true);
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

test("lobbyOf projects a filled seat into occupant/name/image and drops filled", () => {
  const lobby = lobbyOf(
    { kind: "loaded", room: loadedRoom([
      { id: "seat-0", occupant: "user-host", name: "Host Person", image: null, joinedAt: 1 },
      { id: "seat-1", occupant: null, joinedAt: null },
    ]) },
    HOST,
  );
  if (lobby.kind !== "room") throw new Error("expected room");
  const [filled, open] = lobby.seats;
  expect(filled).toEqual({
    index: 0,
    occupant: "user-host",
    name: "Host Person",
    image: "https://api.dicebear.com/10.x/clay/svg?seed=user-host",
    isHost: true,
    isMe: true,
    canKick: false,
  });
  expect(filled).not.toHaveProperty("filled");
  expect(open).toEqual({ index: 1, occupant: null, isHost: false, isMe: false });
});

test("lobbyOf keeps a renderable avatar when the occupant has no name or image", () => {
  const lobby = lobbyOf(
    { kind: "loaded", room: loadedRoom([{ id: "seat-0", occupant: "user-host", joinedAt: 1 }]) },
    HOST,
  );
  if (lobby.kind !== "room") throw new Error("expected room");
  expect(lobby.seats[0]).toMatchObject({
    occupant: "user-host",
    name: null,
    image: "https://api.dicebear.com/10.x/clay/svg?seed=user-host",
  });
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
