import type { RoleId } from "../../../shared/core/lockstep/games/g54/roles.ts";
import { generateCode, type RoomEntropy } from "../../../shared/rooms/code.ts";
import type { ChangeReason, RoomEvents } from "../../../shared/rooms/events.ts";
import type { RoomCode, RoomId, UserId } from "../../../shared/rooms/ids.ts";
import { err, ok, type Result } from "../../../shared/rooms/result.ts";
import {
  createRoom as buildRoom,
  isExpired,
  joinRoom as applyJoin,
  kickFromRoom as applyKick,
  leaveRoom as applyLeave,
  renameRoom,
  requireHost,
  setRoles,
  type Departure,
  type Room,
  type RoomError,
} from "../../../shared/rooms/room.ts";
import type { Db } from "../../utils/db.ts";
import {
  deleteExpiredRooms,
  insertRoom,
  removeRoom,
  removeRoomIf,
  roomByCode,
  saveRoom,
  type LoadedRoom,
} from "./store.ts";

const CODE_ATTEMPTS = 5;
const CAS_ATTEMPTS = 3;

export interface RoomDeps {
  db: Db;
  entropy: RoomEntropy;
  newId: () => RoomId;
  now: () => number;
  events: RoomEvents;
}

export interface CreateRoomInput {
  host: UserId;
  name?: string;
  seats: number;
  roles: readonly RoleId[];
}

export interface JoinRoomInput {
  code: RoomCode;
  user: UserId;
}

export interface UpdateRoomInput {
  code: RoomCode;
  actor: UserId;
  name?: string;
  roles?: readonly RoleId[];
}

export interface DeleteRoomInput {
  code: RoomCode;
  actor: UserId;
}

export interface LeaveRoomInput {
  code: RoomCode;
  user: UserId;
}

export interface KickUserInput {
  code: RoomCode;
  actor: UserId;
  target: UserId;
}

const notFound: RoomError = { kind: "not-found" };

const load = async (deps: RoomDeps, code: RoomCode): Promise<LoadedRoom | null> => {
  const loaded = await roomByCode(deps.db, code);
  return loaded !== null && !isExpired(loaded.room, deps.now()) ? loaded : null;
};

// The room write is the source of truth; a publish failure must not fail the
// mutation, and the adapter's swallow is not something the service may rely on.
const emit = async (deps: RoomDeps, room: Room, reason: ChangeReason): Promise<void> => {
  try {
    await deps.events.changed(room, reason);
  } catch {}
};

export const createRoom = async (
  deps: RoomDeps,
  input: CreateRoomInput,
): Promise<Result<Room, RoomError>> => {
  const now = deps.now();
  await deleteExpiredRooms(deps.db, now);
  let lastError: RoomError = { kind: "conflict" };
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const built = buildRoom({
      id: deps.newId(),
      code: generateCode(deps.entropy),
      host: input.host,
      name: input.name ?? "",
      seats: input.seats,
      setup: { roles: [...input.roles] },
      now,
    });
    if (!built.ok) return built;
    const inserted = await insertRoom(deps.db, built.value);
    if (inserted === "ok") {
      await emit(deps, built.value, "created");
      return ok(built.value);
    }
    lastError = { kind: "conflict" };
  }
  return err(lastError);
};

export const getRoom = async (deps: RoomDeps, code: RoomCode): Promise<Result<Room, RoomError>> => {
  const loaded = await load(deps, code);
  return loaded === null ? err(notFound) : ok(loaded.room);
};

const mutate = async (
  deps: RoomDeps,
  code: RoomCode,
  reason: ChangeReason,
  apply: (room: Room) => Result<Room, RoomError>,
): Promise<Result<Room, RoomError>> => {
  for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
    const loaded = await load(deps, code);
    if (loaded === null) return err(notFound);
    const next = apply(loaded.room);
    if (!next.ok) return next;
    if (await saveRoom(deps.db, next.value, loaded.revision)) {
      await emit(deps, next.value, reason);
      return ok(next.value);
    }
  }
  return err({ kind: "conflict" });
};

export const joinRoom = (
  deps: RoomDeps,
  input: JoinRoomInput,
): Promise<Result<Room, RoomError>> =>
  mutate(deps, input.code, "joined", (room) => applyJoin(room, { user: input.user, now: deps.now() }));

export const updateRoom = (
  deps: RoomDeps,
  input: UpdateRoomInput,
): Promise<Result<Room, RoomError>> =>
  mutate(deps, input.code, "updated", (room) => {
    let next: Result<Room, RoomError> = ok(room);
    if (input.name !== undefined) {
      next = renameRoom(room, { actor: input.actor, name: input.name, now: deps.now() });
      if (!next.ok) return next;
    }
    if (input.roles !== undefined) {
      next = setRoles(next.value, { actor: input.actor, roles: input.roles, now: deps.now() });
      if (!next.ok) return next;
    }
    return next;
  });

const depart = async (
  deps: RoomDeps,
  code: RoomCode,
  apply: (room: Room) => Result<Departure, RoomError>,
): Promise<Result<Room | null, RoomError>> => {
  for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
    const loaded = await load(deps, code);
    if (loaded === null) return err(notFound);
    const next = apply(loaded.room);
    if (!next.ok) return next;
    if (next.value.kind === "empty") {
      if (await removeRoomIf(deps.db, loaded.room.id, loaded.revision)) {
        await emit(deps, loaded.room, "deleted");
        return ok(null);
      }
      continue;
    }
    if (await saveRoom(deps.db, next.value.room, loaded.revision)) {
      await emit(deps, next.value.room, "updated");
      return ok(next.value.room);
    }
  }
  return err({ kind: "conflict" });
};

export const leaveRoom = (
  deps: RoomDeps,
  input: LeaveRoomInput,
): Promise<Result<Room | null, RoomError>> =>
  depart(deps, input.code, (room) => applyLeave(room, { actor: input.user, now: deps.now() }));

export const kickUser = (
  deps: RoomDeps,
  input: KickUserInput,
): Promise<Result<Room | null, RoomError>> =>
  depart(deps, input.code, (room) =>
    applyKick(room, { actor: input.actor, target: input.target, now: deps.now() }),
  );

export const deleteRoom = async (
  deps: RoomDeps,
  input: DeleteRoomInput,
): Promise<Result<void, RoomError>> => {
  const loaded = await load(deps, input.code);
  if (loaded === null) return err(notFound);
  const denied = requireHost(loaded.room, input.actor);
  if (denied !== null) return err(denied);
  await removeRoom(deps.db, loaded.room);
  await emit(deps, loaded.room, "deleted");
  return ok(undefined);
};
