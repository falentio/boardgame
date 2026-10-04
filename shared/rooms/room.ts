import { G54Error } from "../core/lockstep/games/g54/error.ts";
import { validateRoles } from "../core/lockstep/games/g54/setup.ts";
import type { G54Setup } from "../core/lockstep/games/g54/setup.ts";
import type { RoleId } from "../core/lockstep/games/g54/roles.ts";
import { seatId, type SeatId } from "./ids.ts";
import { err, ok, type Result } from "./result.ts";
import type { RoomCode, RoomId, UserId } from "./ids.ts";

export const MAX_NAME_LENGTH = 60;
export const MAX_SEATS = 7;

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
}

export type RoomError =
  | { kind: "invalid-name"; reason: string }
  | { kind: "invalid-seat-count"; reason: string }
  | { kind: "invalid-setup"; reason: string }
  | { kind: "not-found" }
  | { kind: "not-host" }
  | { kind: "already-seated" }
  | { kind: "room-full" }
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
  if (!Number.isInteger(input.seats) || input.seats < 1 || input.seats > MAX_SEATS) {
    return err({
      kind: "invalid-seat-count",
      reason: `seats must be an integer in 1..${MAX_SEATS}`,
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
  });
};

export const joinRoom = (room: Room, cmd: JoinCommand): Result<Room, RoomError> => {
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
  try {
    validateRoles(cmd.roles);
  } catch (error) {
    if (!(error instanceof G54Error)) throw error;
    return err({ kind: "invalid-setup", reason: error.message });
  }
  return ok({ ...room, setup: { roles: [...cmd.roles] }, updatedAt: cmd.now });
};
