import { isRoleId, type RoleId } from "../../shared/core/lockstep/games/g54/roles.ts";
import { isRoomCode, roomCode, userId, type RoomCode, type UserId } from "../../shared/rooms/ids.ts";
import type { RoomError } from "../../shared/rooms/room.ts";

export interface Seat {
  id: string;
  occupant: UserId | null;
  joinedAt: number | null;
}

export interface Room {
  code: RoomCode;
  name: string;
  host: UserId;
  link: string;
  roles: readonly RoleId[];
  seats: readonly Seat[];
}

export type RoomLoad =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "missing" }
  | { kind: "failed"; reason: string }
  | { kind: "loaded"; room: Room };

export type LobbyStatus =
  | { kind: "waiting"; filled: number; total: number }
  | { kind: "full"; filled: number; total: number };

export interface SeatRow {
  index: number;
  filled: boolean;
  isHost: boolean;
  isMe: boolean;
}

export type Lobby =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "missing" }
  | { kind: "failed"; reason: string }
  | {
      kind: "room";
      room: Room;
      seats: readonly SeatRow[];
      status: LobbyStatus;
      amIHost: boolean;
      amISeated: boolean;
      canStart: boolean;
    };

const fieldOf = (source: unknown, key: string): unknown => {
  if (typeof source !== "object" || source === null) return undefined;
  return key in source ? (source as Record<string, unknown>)[key] : undefined;
};

const parseSeat = (raw: unknown): Seat | null => {
  const id = fieldOf(raw, "id");
  if (typeof id !== "string" || id.length === 0) return null;

  const occupant = fieldOf(raw, "occupant");
  if (occupant !== null && (typeof occupant !== "string" || occupant.length === 0)) return null;

  const joinedAt = fieldOf(raw, "joinedAt");
  if (joinedAt !== null && typeof joinedAt !== "number") return null;

  return {
    id,
    occupant: occupant === null ? null : userId(occupant),
    joinedAt,
  };
};

export const parseRoom = (raw: unknown): Room | null => {
  const code = fieldOf(raw, "code");
  if (typeof code !== "string" || !isRoomCode(code)) return null;

  const name = fieldOf(raw, "name");
  if (typeof name !== "string") return null;

  const host = fieldOf(raw, "host");
  if (typeof host !== "string" || host.length === 0) return null;

  const link = fieldOf(raw, "link");
  if (typeof link !== "string") return null;

  const rawRoles = fieldOf(fieldOf(raw, "setup"), "roles");
  if (!Array.isArray(rawRoles)) return null;
  const roles = rawRoles.filter((role): role is RoleId => typeof role === "string" && isRoleId(role));

  const rawSeats = fieldOf(raw, "seats");
  if (!Array.isArray(rawSeats)) return null;
  const seats: Seat[] = [];
  for (const rawSeat of rawSeats) {
    const seat = parseSeat(rawSeat);
    if (seat === null) return null;
    seats.push(seat);
  }

  return {
    code: roomCode(code),
    name,
    host: userId(host),
    link,
    roles,
    seats,
  };
};

export const roomErrorKind = (error: unknown): RoomError["kind"] | null => {
  const kind = fieldOf(fieldOf(fieldOf(error, "data"), "error"), "kind");
  return typeof kind === "string" ? (kind as RoomError["kind"]) : null;
};

export const lobbyOf = (load: RoomLoad, viewer: UserId | null): Lobby => {
  if (load.kind !== "loaded") return load;

  const room = load.room;
  const filled = room.seats.filter((seat) => seat.occupant !== null).length;
  const total = room.seats.length;
  const status: LobbyStatus =
    filled === total ? { kind: "full", filled, total } : { kind: "waiting", filled, total };

  const seats = room.seats.map(
    (seat, index): SeatRow => ({
      index,
      filled: seat.occupant !== null,
      isHost: seat.occupant === room.host,
      isMe: viewer !== null && seat.occupant === viewer,
    }),
  );

  const amIHost = viewer !== null && room.host === viewer;
  const amISeated = viewer !== null && room.seats.some((seat) => seat.occupant === viewer);

  return {
    kind: "room",
    room,
    seats,
    status,
    amIHost,
    amISeated,
    canStart: amIHost && status.kind === "full",
  };
};

export const keepLastGood = (prev: RoomLoad, next: RoomLoad): RoomLoad =>
  next.kind === "failed" && prev.kind === "loaded" ? prev : next;
