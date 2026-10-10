import { isRoleId, type RoleId } from "#shared/core/lockstep/games/g54/roles.ts";
import { isRoomCode, roomCode, userId, type RoomCode, type UserId } from "#shared/rooms/ids.ts";
import { MIN_SEATS, type RoomError } from "#shared/rooms/room.ts";
import { resolveUserImage } from "#shared/users/avatar.ts";

export interface Seat {
  id: string;
  occupant: UserId | null;
  name: string | null;
  image: string | null;
  joinedAt: number | null;
}

export interface Room {
  code: RoomCode;
  name: string;
  host: UserId;
  link: string;
  roles: readonly RoleId[];
  seats: readonly Seat[];
  startedAt: number | null;
  expiresAt: number | null;
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

export type SeatRow =
  | {
      readonly index: number;
      readonly occupant: null;
      readonly isHost: false;
      readonly isMe: false;
    }
  | {
      readonly index: number;
      readonly occupant: UserId;
      readonly name: string | null;
      readonly image: string;
      readonly isHost: boolean;
      readonly isMe: boolean;
      readonly canKick: boolean;
    };

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
      started: boolean;
      canStart: boolean;
      canLeave: boolean;
      canKick: boolean;
      gameRedirect: boolean;
      expiresAt: number | null;
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

  const name = fieldOf(raw, "name");
  const image = fieldOf(raw, "image");

  return {
    id,
    occupant: occupant === null ? null : userId(occupant),
    name: typeof name === "string" ? name : null,
    image: typeof image === "string" ? image : null,
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

  const startedAt = fieldOf(raw, "startedAt");
  const expiresAt = fieldOf(raw, "expiresAt");

  return {
    code: roomCode(code),
    name,
    host: userId(host),
    link,
    roles,
    seats,
    startedAt: typeof startedAt === "number" ? startedAt : null,
    expiresAt: typeof expiresAt === "number" ? expiresAt : null,
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

  const amIHost = viewer !== null && room.host === viewer;
  const amISeated = viewer !== null && room.seats.some((seat) => seat.occupant === viewer);
  const started = room.startedAt !== null;
  const canKick = amIHost && !started;

  const seats = room.seats.map((seat, index): SeatRow => {
    if (seat.occupant === null) {
      return { index, occupant: null, isHost: false, isMe: false };
    }
    const isMe = viewer !== null && seat.occupant === viewer;
    return {
      index,
      occupant: seat.occupant,
      name: seat.name,
      image: resolveUserImage(seat.image, seat.occupant),
      isHost: seat.occupant === room.host,
      isMe,
      canKick: canKick && !isMe,
    };
  });

  return {
    kind: "room",
    room,
    seats,
    status,
    amIHost,
    amISeated,
    started,
    canStart: amIHost && !started && filled >= MIN_SEATS,
    canLeave: amISeated && !started,
    canKick,
    gameRedirect: started && amISeated && !amIHost,
    expiresAt: room.expiresAt,
  };
};

export const keepLastGood = (prev: RoomLoad, next: RoomLoad): RoomLoad =>
  next.kind === "failed" && prev.kind === "loaded" ? prev : next;
