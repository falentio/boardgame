import { Hono, type Context } from "hono";
import { isRoleId, type RoleId } from "../../../shared/core/lockstep/games/g54/roles.ts";
import { encodeEnvelope, parseEnvelope, type GameEvents } from "../../../shared/game/events.ts";
import type { RoomEvents } from "../../../shared/rooms/events.ts";
import type { AppAuth } from "../../utils/auth.ts";
import type { Db } from "../../utils/db.ts";
import type { RoomEntropy } from "../../../shared/rooms/code.ts";
import { parseRoomCode } from "../../../shared/rooms/code.ts";
import { joinUrl } from "../../../shared/rooms/link.ts";
import { userId, type RoomCode, type RoomId, type UserId } from "../../../shared/rooms/ids.ts";
import type { Result } from "../../../shared/rooms/result.ts";
import { ROOM_TTL_MS, type Room, type RoomError, type Seat } from "../../../shared/rooms/room.ts";
import {
  occupantsOf,
  type OccupantDirectory,
} from "../users/directory.ts";
import {
  createRoom,
  deleteRoom,
  getRoom,
  joinRoom,
  kickUser,
  leaveRoom,
  startRoom,
  updateRoom,
  type RoomDeps,
} from "./service.ts";

export interface RoomAppDeps {
  db: Db;
  auth: AppAuth;
  entropy: RoomEntropy;
  newId: () => RoomId;
  now: () => number;
  events: RoomEvents;
  gameEvents: GameEvents;
}

interface SeatView {
  id: string;
  occupant: string | null;
  name: string | null;
  image: string | null;
  joinedAt: number | null;
}

interface RoomView {
  id: string;
  code: string;
  link: string;
  host: string;
  name: string;
  setup: { roles: readonly RoleId[] };
  seats: readonly SeatView[];
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  expiresAt: number;
}

const statusFor = (kind: RoomError["kind"]): 400 | 403 | 404 | 409 => {
  switch (kind) {
    case "invalid-name":
    case "invalid-seat-count":
    case "invalid-setup":
    case "invalid-kick":
      return 400;
    case "not-found":
      return 404;
    case "not-host":
      return 403;
    case "already-seated":
    case "room-full":
    case "not-seated":
    case "already-started":
    case "room-not-full":
    case "conflict":
      return 409;
  }
};

const originOf = (c: Context): string => new URL(c.req.url).origin;

const occupantIdsOf = (seats: readonly Seat[]): UserId[] => {
  const ids = new Set<UserId>();
  for (const seat of seats) {
    if (seat.occupant !== null) ids.add(seat.occupant);
  }
  return [...ids];
};

const toView = (room: Room, origin: string, occupants: OccupantDirectory): RoomView => ({
  id: room.id,
  code: room.code,
  link: joinUrl(origin, room.code),
  host: room.host,
  name: room.name,
  setup: { roles: room.setup.roles },
  seats: room.seats.map((seat) => {
    const identity = seat.occupant === null ? null : occupants.get(seat.occupant) ?? null;
    return {
      id: seat.id,
      occupant: seat.occupant,
      name: identity?.name ?? null,
      image: identity?.image ?? null,
      joinedAt: seat.joinedAt,
    };
  }),
  createdAt: room.createdAt,
  updatedAt: room.updatedAt,
  startedAt: room.startedAt,
  expiresAt: room.createdAt + ROOM_TTL_MS,
});

const parseRoles = (value: unknown): RoleId[] | null => {
  if (!Array.isArray(value)) return null;
  const roles: RoleId[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !isRoleId(item)) return null;
    roles.push(item);
  }
  return roles;
};

const readObject = async (c: Context): Promise<Record<string, unknown> | null> => {
  try {
    const body: unknown = await c.req.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

export const createRoomApp = (deps: RoomAppDeps): Hono => {
  const app = new Hono().basePath("/api/rooms");
  const serviceDeps: RoomDeps = {
    db: deps.db,
    entropy: deps.entropy,
    newId: deps.newId,
    now: deps.now,
    events: deps.events,
  };

  const session = (c: Context) => deps.auth.api.getSession({ headers: c.req.raw.headers });

  const unauthorized = (c: Context) => c.json({ error: { kind: "unauthorized" } }, 401);
  const badRequest = (c: Context, reason: string) =>
    c.json({ error: { kind: "invalid-request", reason } }, 400);

  const respond = async (
    c: Context,
    result: Result<Room | null, RoomError>,
    status: 200 | 201 = 200,
  ): Promise<Response> => {
    if (!result.ok) return c.json({ error: result.error }, statusFor(result.error.kind));
    if (result.value === null) return c.body(null, 204);
    const occupants = await occupantsOf(deps.db, occupantIdsOf(result.value.seats));
    return c.json({ room: toView(result.value, originOf(c), occupants) }, status);
  };

  const codeFrom = (c: Context): RoomCode | null => parseRoomCode(c.req.param("code") ?? "");

  app.post("/", async (c) => {
    const auth = await session(c);
    if (!auth) return unauthorized(c);
    const body = await readObject(c);
    if (body === null) return badRequest(c, "body must be a JSON object");
    const seats = body.seats;
    if (typeof seats !== "number") return badRequest(c, "seats must be a number");
    const roles = parseRoles(body.roles);
    if (roles === null) return badRequest(c, "roles must be an array of role ids");
    const name = body.name;
    if (name !== undefined && typeof name !== "string") return badRequest(c, "name must be a string");

    const result = await createRoom(serviceDeps, {
      host: userId(auth.user.id),
      name: name ?? "New room",
      seats,
      roles,
    });
    return respond(c, result, 201);
  });

  app.get("/:code", async (c) => {
    const auth = await session(c);
    if (!auth) return unauthorized(c);
    const code = codeFrom(c);
    if (code === null) return badRequest(c, "code must be 8 or 9 letters");
    return respond(c, await getRoom(serviceDeps, code));
  });

  app.post("/:code/join", async (c) => {
    const auth = await session(c);
    if (!auth) return unauthorized(c);
    const code = codeFrom(c);
    if (code === null) return badRequest(c, "code must be 8 or 9 letters");
    return respond(c, await joinRoom(serviceDeps, { code, user: userId(auth.user.id) }));
  });

  app.post("/:code/leave", async (c) => {
    const auth = await session(c);
    if (!auth) return unauthorized(c);
    const code = codeFrom(c);
    if (code === null) return badRequest(c, "code must be 8 or 9 letters");
    return respond(c, await leaveRoom(serviceDeps, { code, user: userId(auth.user.id) }));
  });

  app.post("/:code/kick", async (c) => {
    const auth = await session(c);
    if (!auth) return unauthorized(c);
    const code = codeFrom(c);
    if (code === null) return badRequest(c, "code must be 8 or 9 letters");
    const body = await readObject(c);
    if (body === null) return badRequest(c, "body must be a JSON object");
    const target = body.user;
    if (typeof target !== "string" || target.length === 0) {
      return badRequest(c, "user must be a non-empty string");
    }
    return respond(
      c,
      await kickUser(serviceDeps, { code, actor: userId(auth.user.id), target: userId(target) }),
    );
  });

  app.post("/:code/start", async (c) => {
    const auth = await session(c);
    if (!auth) return unauthorized(c);
    const code = codeFrom(c);
    if (code === null) return badRequest(c, "code must be 8 or 9 letters");
    return respond(c, await startRoom(serviceDeps, { code, actor: userId(auth.user.id) }));
  });

  app.post("/:code/game", async (c) => {
    const auth = await session(c);
    if (!auth) return unauthorized(c);
    const code = codeFrom(c);
    if (code === null) return badRequest(c, "code must be 8 or 9 letters");
    const body = await readObject(c);
    if (body === null) return badRequest(c, "body must be a JSON object");
    const envelope = parseEnvelope(body);
    if (envelope.kind !== "ok") return badRequest(c, "malformed or stale game message");
    const room = await getRoom(serviceDeps, code);
    if (!room.ok) return c.json({ error: room.error }, statusFor(room.error.kind));
    const sender = userId(auth.user.id);
    if (!room.value.seats.some((seat) => seat.occupant === sender)) {
      return c.json({ error: { kind: "not-found" } }, 403);
    }
    await deps.gameEvents.published(code, encodeEnvelope(envelope.body));
    return c.body(null, 204);
  });

  app.patch("/:code", async (c) => {
    const auth = await session(c);
    if (!auth) return unauthorized(c);
    const code = codeFrom(c);
    if (code === null) return badRequest(c, "code must be 8 or 9 letters");
    const body = await readObject(c);
    if (body === null) return badRequest(c, "body must be a JSON object");
    const name = body.name;
    if (name !== undefined && typeof name !== "string") return badRequest(c, "name must be a string");
    let roles: RoleId[] | undefined;
    if (body.roles !== undefined) {
      const parsed = parseRoles(body.roles);
      if (parsed === null) return badRequest(c, "roles must be an array of role ids");
      roles = parsed;
    }
    return respond(
      c,
      await updateRoom(serviceDeps, { code, actor: userId(auth.user.id), name, roles }),
    );
  });

  app.delete("/:code", async (c) => {
    const auth = await session(c);
    if (!auth) return unauthorized(c);
    const code = codeFrom(c);
    if (code === null) return badRequest(c, "code must be 8 or 9 letters");
    const result = await deleteRoom(serviceDeps, { code, actor: userId(auth.user.id) });
    if (!result.ok) return c.json({ error: result.error }, statusFor(result.error.kind));
    return c.body(null, 204);
  });

  return app;
};
