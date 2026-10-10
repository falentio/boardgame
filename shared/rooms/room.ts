import { G54Error } from "../core/lockstep/games/g54/error.ts";
import { validateRoles } from "../core/lockstep/games/g54/setup.ts";
import type { G54Setup } from "../core/lockstep/games/g54/setup.ts";
import type { RoleId } from "../core/lockstep/games/g54/roles.ts";
import { seatId, type SeatId } from "./ids.ts";
import { err, ok, type Result } from "./result.ts";
import type { RoomCode, RoomId, UserId } from "./ids.ts";

export const MAX_NAME_LENGTH = 60;
export const MIN_SEATS = 2;
export const MAX_SEATS = 7;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export interface Seat {
  readonly id: SeatId;
  readonly occupant: UserId | null;
  readonly joinedAt: number | null;
}

export interface Room {
  readonly id: RoomId;
  readonly code: RoomCode;
  readonly host: UserId;
  readonly name: string;
  readonly setup: G54Setup;
  readonly seats: readonly Seat[];
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly startedAt: number | null;
}

export const isExpired = (room: Room, now: number): boolean =>
  now >= room.createdAt + ROOM_TTL_MS;

export const hasEnoughPlayers = (room: Room): boolean =>
  room.seats.filter((seat) => seat.occupant !== null).length >= MIN_SEATS;

export type RoomError =
  | { kind: "invalid-name"; reason: string }
  | { kind: "invalid-seat-count"; reason: string }
  | { kind: "invalid-setup"; reason: string }
  | { kind: "not-found" }
  | { kind: "not-host" }
  | { kind: "already-seated" }
  | { kind: "room-full" }
  | { kind: "not-seated" }
  | { kind: "invalid-kick"; reason: string }
  | { kind: "already-started" }
  | { kind: "not-enough-players" }
  | { kind: "conflict" };

export interface NewRoom {
  id: RoomId;
  code: RoomCode;
  host: UserId;
  name: string;
  seats: number;
  setup: G54Setup;
  now: number;
}

export interface JoinCommand {
  user: UserId;
  now: number;
}

export interface StartRoomCommand {
  readonly actor: UserId;
  readonly now: number;
}

export interface RenameCommand {
  actor: UserId;
  name: string;
  now: number;
}

export interface SetRolesCommand {
  actor: UserId;
  roles: readonly RoleId[];
  now: number;
}

export type Departure =
  | { readonly kind: "room"; readonly room: Room }
  | { readonly kind: "empty" };

export interface LeaveCommand {
  readonly actor: UserId;
  readonly now: number;
}

export interface KickCommand {
  readonly actor: UserId;
  readonly target: UserId;
  readonly now: number;
}

const validName = (raw: string): string | null => {
  const name = raw.trim();
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) return null;
  return name;
};

export const requireHost = (room: Room, actor: UserId): RoomError | null =>
  room.host === actor ? null : { kind: "not-host" };

export const createRoom = (input: NewRoom): Result<Room, RoomError> => {
  const name = validName(input.name);
  if (name === null) {
    return err({ kind: "invalid-name", reason: `name must be 1..${MAX_NAME_LENGTH} chars` });
  }
  if (!Number.isInteger(input.seats) || input.seats < MIN_SEATS || input.seats > MAX_SEATS) {
    return err({
      kind: "invalid-seat-count",
      reason: `seats must be an integer in ${MIN_SEATS}..${MAX_SEATS}`,
    });
  }
  try {
    validateRoles(input.setup.roles);
  } catch (error) {
    if (!(error instanceof G54Error)) throw error;
    return err({ kind: "invalid-setup", reason: error.message });
  }
  const seats: Seat[] = Array.from({ length: input.seats }, (_, index) =>
    index === 0
      ? { id: seatId(`${input.id}:seat:0`), occupant: input.host, joinedAt: input.now }
      : { id: seatId(`${input.id}:seat:${String(index)}`), occupant: null, joinedAt: null },
  );
  return ok({
    id: input.id,
    code: input.code,
    host: input.host,
    name,
    setup: input.setup,
    seats,
    createdAt: input.now,
    updatedAt: input.now,
    startedAt: null,
  });
};

export const joinRoom = (room: Room, cmd: JoinCommand): Result<Room, RoomError> => {
  if (room.startedAt !== null) return err({ kind: "already-started" });
  if (room.seats.some((seat) => seat.occupant === cmd.user)) {
    return err({ kind: "already-seated" });
  }
  const index = room.seats.findIndex((seat) => seat.occupant === null);
  if (index === -1) return err({ kind: "room-full" });
  const seats = room.seats.map((seat, position) =>
    position === index ? { id: seat.id, occupant: cmd.user, joinedAt: cmd.now } : seat,
  );
  return ok({ ...room, seats, updatedAt: cmd.now });
};

const vacate = (room: Room, index: number, now: number): Departure => {
  const leaving = room.seats[index]!.occupant!;
  const seats = room.seats.map((seat, position) =>
    position === index ? { id: seat.id, occupant: null, joinedAt: null } : seat,
  );
  const remaining = seats.filter((seat) => seat.occupant !== null);
  if (remaining.length === 0) return { kind: "empty" };
  const host = leaving === room.host ? remaining[0]!.occupant! : room.host;
  return { kind: "room", room: { ...room, host, seats, updatedAt: now } };
};

export const leaveRoom = (room: Room, cmd: LeaveCommand): Result<Departure, RoomError> => {
  if (room.startedAt !== null) return err({ kind: "already-started" });
  const index = room.seats.findIndex((seat) => seat.occupant === cmd.actor);
  if (index === -1) return err({ kind: "not-seated" });
  return ok(vacate(room, index, cmd.now));
};

export const kickFromRoom = (room: Room, cmd: KickCommand): Result<Departure, RoomError> => {
  const denied = requireHost(room, cmd.actor);
  if (denied !== null) return err(denied);
  if (room.startedAt !== null) return err({ kind: "already-started" });
  if (cmd.target === cmd.actor) {
    return err({ kind: "invalid-kick", reason: "the host cannot kick itself" });
  }
  const index = room.seats.findIndex((seat) => seat.occupant === cmd.target);
  if (index === -1) return err({ kind: "not-seated" });
  return ok(vacate(room, index, cmd.now));
};

export const startRoom = (room: Room, cmd: StartRoomCommand): Result<Room, RoomError> => {
  const denied = requireHost(room, cmd.actor);
  if (denied !== null) return err(denied);
  if (room.startedAt !== null) return ok(room);
  if (!hasEnoughPlayers(room)) return err({ kind: "not-enough-players" });
  return ok({ ...room, startedAt: cmd.now, updatedAt: cmd.now });
};

export const renameRoom = (room: Room, cmd: RenameCommand): Result<Room, RoomError> => {
  const denied = requireHost(room, cmd.actor);
  if (denied !== null) return err(denied);
  const name = validName(cmd.name);
  if (name === null) {
    return err({ kind: "invalid-name", reason: `name must be 1..${MAX_NAME_LENGTH} chars` });
  }
  return ok({ ...room, name, updatedAt: cmd.now });
};

export const setRoles = (room: Room, cmd: SetRolesCommand): Result<Room, RoomError> => {
  const denied = requireHost(room, cmd.actor);
  if (denied !== null) return err(denied);
  if (room.startedAt !== null) return err({ kind: "already-started" });
  try {
    validateRoles(cmd.roles);
  } catch (error) {
    if (!(error instanceof G54Error)) throw error;
    return err({ kind: "invalid-setup", reason: error.message });
  }
  return ok({ ...room, setup: { roles: [...cmd.roles] }, updatedAt: cmd.now });
};
