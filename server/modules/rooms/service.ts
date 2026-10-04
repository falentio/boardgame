import type { RoleId } from "../../../shared/core/lockstep/games/g54/roles.ts";
import { generateCode, type RoomEntropy } from "../../../shared/rooms/code.ts";
import type { RoomCode, RoomId, UserId } from "../../../shared/rooms/ids.ts";
import { err, ok, type Result } from "../../../shared/rooms/result.ts";
import {
  createRoom as buildRoom,
  joinRoom as applyJoin,
  renameRoom,
  requireHost,
  setRoles,
  type Room,
  type RoomError,
} from "../../../shared/rooms/room.ts";
import type { Db } from "../../utils/db.ts";
import { insertRoom, removeRoom, roomByCode, saveRoom } from "./store.ts";

const CODE_ATTEMPTS = 5;
const CAS_ATTEMPTS = 3;

export interface RoomDeps {
  db: Db;
  entropy: RoomEntropy;
  newId: () => RoomId;
  now: () => number;
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

const notFound: RoomError = { kind: "not-found" };

export const createRoom = async (
  deps: RoomDeps,
  input: CreateRoomInput,
): Promise<Result<Room, RoomError>> => {
  const now = deps.now();
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
    if (inserted === "ok") return ok(built.value);
    lastError = { kind: "conflict" };
  }
  return err(lastError);
};

export const getRoom = async (deps: RoomDeps, code: RoomCode): Promise<Result<Room, RoomError>> => {
  const loaded = await roomByCode(deps.db, code);
  return loaded === null ? err(notFound) : ok(loaded.room);
};

const mutate = async (
  deps: RoomDeps,
  code: RoomCode,
  apply: (room: Room) => Result<Room, RoomError>,
): Promise<Result<Room, RoomError>> => {
  for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
    const loaded = await roomByCode(deps.db, code);
    if (loaded === null) return err(notFound);
    const next = apply(loaded.room);
    if (!next.ok) return next;
    if (await saveRoom(deps.db, next.value, loaded.revision)) return ok(next.value);
  }
  return err({ kind: "conflict" });
};

export const joinRoom = (
  deps: RoomDeps,
  input: JoinRoomInput,
): Promise<Result<Room, RoomError>> =>
  mutate(deps, input.code, (room) => applyJoin(room, { user: input.user, now: deps.now() }));

export const updateRoom = (
  deps: RoomDeps,
  input: UpdateRoomInput,
): Promise<Result<Room, RoomError>> =>
  mutate(deps, input.code, (room) => {
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

export const deleteRoom = async (
  deps: RoomDeps,
  input: DeleteRoomInput,
): Promise<Result<void, RoomError>> => {
  const loaded = await roomByCode(deps.db, input.code);
  if (loaded === null) return err(notFound);
  const denied = requireHost(loaded.room, input.actor);
  if (denied !== null) return err(denied);
  await removeRoom(deps.db, loaded.room);
  return ok(undefined);
};
