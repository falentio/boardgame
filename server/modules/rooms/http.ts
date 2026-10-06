import { Hono, type Context } from "hono";
import { isRoleId, type RoleId } from "../../../shared/core/lockstep/games/g54/roles.ts";
import type { RoomEvents } from "../../../shared/rooms/events.ts";
import type { AppAuth } from "../../utils/auth.ts";
import type { Db } from "../../utils/db.ts";
import type { RoomEntropy } from "../../../shared/rooms/code.ts";
import { parseRoomCode } from "../../../shared/rooms/code.ts";
import { userId, type RoomCode, type RoomId, type UserId } from "../../../shared/rooms/ids.ts";
import type { Result } from "../../../shared/rooms/result.ts";
import type { Room, RoomError, Seat } from "../../../shared/rooms/room.ts";
import {
  occupantsOf,
  type OccupantDirectory,
} from "../users/directory.ts";
import {
  createRoom,
  deleteRoom,
  getRoom,
  joinRoom,
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
}

const statusFor = (kind: RoomError["kind"]): 400 | 403 | 404 | 409 => {
  switch (kind) {
    case "invalid-name":
    case "invalid-seat-count":
    case "invalid-setup":
      return 400;
    case "not-found":
      return 404;
    case "not-host":
      return 403;
    case "already-seated":
    case "room-full":
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
  link: `${origin}/join/${room.code}`,
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
    result: Result<Room, RoomError>,
    status: 200 | 201 = 200,
  ): Promise<Response> => {
    if (!result.ok) return c.json({ error: result.error }, statusFor(result.error.kind));
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
    if (code === null) return badRequest(c, "code must be 8 chars CVCVCVCV");
    return respond(c, await getRoom(serviceDeps, code));
  });

  app.post("/:code/join", async (c) => {
    const auth = await session(c);
    if (!auth) return unauthorized(c);
    const code = codeFrom(c);
    if (code === null) return badRequest(c, "code must be 8 chars CVCVCVCV");
    return respond(c, await joinRoom(serviceDeps, { code, user: userId(auth.user.id) }));
  });

  app.patch("/:code", async (c) => {
    const auth = await session(c);
    if (!auth) return unauthorized(c);
    const code = codeFrom(c);
    if (code === null) return badRequest(c, "code must be 8 chars CVCVCVCV");
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
    if (code === null) return badRequest(c, "code must be 8 chars CVCVCVCV");
    const result = await deleteRoom(serviceDeps, { code, actor: userId(auth.user.id) });
    if (!result.ok) return c.json({ error: result.error }, statusFor(result.error.kind));
    return c.body(null, 204);
  });

  return app;
};
