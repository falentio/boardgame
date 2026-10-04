import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { STARTER_ROLES } from "../../../../shared/core/lockstep/games/g54/roles.ts";
import { makeRandom } from "../../../../shared/core/lockstep/hash.ts";
import { seed } from "../../../../shared/core/lockstep/ids.ts";
import { roomId } from "../../../../shared/rooms/ids.ts";
import { authFromEnv, requireSession } from "../../../utils/auth.ts";
import { cloudflareEnv } from "../../../utils/db.ts";
import { createRoomApp } from "../http.ts";
import { createTestDb, type TestDb } from "./d1-harness.ts";
import { recordingEvents } from "./recording-events.ts";

const ORIGIN = "http://localhost:3000";

interface Account {
  cookie: string;
  id: string;
}

let harness: TestDb;
let idCounter = 0;
let app: ReturnType<typeof createRoomApp>;

beforeEach(async () => {
  harness = await createTestDb();
  idCounter = 0;
  app = createRoomApp({
    db: harness.db,
    auth: authFromEnv(harness.env),
    entropy: makeRandom(seed("00000000000000ff")),
    newId: () => roomId(`room-${String((idCounter += 1))}`),
    now: () => 1000,
    events: recordingEvents().events,
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await harness.dispose();
});

const signUp = async (email: string): Promise<Account> => {
  const auth = authFromEnv(harness.env);
  const response = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, password: "password-123", name: email }),
    }),
  );
  const cookie = response.headers.get("set-cookie");
  if (response.status !== 200 || cookie === null) {
    throw new Error(`sign-up failed: ${response.status}`);
  }
  const body = (await response.json()) as { user: { id: string } };
  return { cookie, id: body.user.id };
};

const call = async (
  path: string,
  init: RequestInit & { cookie?: string } = {},
): Promise<Response> => {
  const { cookie, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (cookie) headers.set("cookie", cookie);
  if (rest.body) headers.set("content-type", "application/json");
  return app.fetch(new Request(`${ORIGIN}${path}`, { ...rest, headers }));
};

const createBody = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({ seats: 3, roles: STARTER_ROLES, ...overrides });

test("POST /api/rooms creates a room for the signed-in host", async () => {
  const host = await signUp("host@example.com");
  const response = await call("/api/rooms", { method: "POST", cookie: host.cookie, body: createBody({ name: "Alpha" }) });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { room: Record<string, unknown> };
  expect(body.room.name).toBe("Alpha");
  expect(body.room.host).toBe(host.id);
  expect(body.room.link).toBe(`${ORIGIN}/join/${String(body.room.code)}`);
  expect((body.room.setup as { roles: readonly string[] }).roles).toEqual(STARTER_ROLES);
});

test("POST /api/rooms defaults the name and requires a session", async () => {
  const anon = await call("/api/rooms", { method: "POST", body: createBody() });
  expect(anon.status).toBe(401);

  const host = await signUp("host@example.com");
  const response = await call("/api/rooms", { method: "POST", cookie: host.cookie, body: createBody() });
  expect(response.status).toBe(201);
  const body = (await response.json()) as { room: { name: string } };
  expect(body.room.name).toBe("New room");
});

test("POST /api/rooms rejects a bad body with 400", async () => {
  const host = await signUp("host@example.com");
  const noSeats = await call("/api/rooms", { method: "POST", cookie: host.cookie, body: JSON.stringify({ roles: STARTER_ROLES }) });
  expect(noSeats.status).toBe(400);

  const badRoles = await call("/api/rooms", { method: "POST", cookie: host.cookie, body: JSON.stringify({ seats: 3, roles: ["banker"] }) });
  expect(badRoles.status).toBe(400);

  const notJson = await call("/api/rooms", { method: "POST", cookie: host.cookie, body: "not json" });
  expect(notJson.status).toBe(400);
});

test("GET /api/rooms/:code returns the room for a session and 404 for an unknown code", async () => {
  const host = await signUp("host@example.com");
  const created = await call("/api/rooms", { method: "POST", cookie: host.cookie, body: createBody() });
  const { room } = (await created.json()) as { room: { code: string } };

  const fetched = await call(`/api/rooms/${room.code}`, { cookie: host.cookie });
  expect(fetched.status).toBe(200);

  const missing = await call("/api/rooms/BAKUDIRU", { cookie: host.cookie });
  expect(missing.status).toBe(404);

  const badCode = await call("/api/rooms/nope", { cookie: host.cookie });
  expect(badCode.status).toBe(400);

  const anon = await call(`/api/rooms/${room.code}`);
  expect(anon.status).toBe(401);
});

test("POST /api/rooms/:code/join seats a second user and reports 409 for a repeat", async () => {
  const host = await signUp("host@example.com");
  const guest = await signUp("guest@example.com");
  const created = await call("/api/rooms", { method: "POST", cookie: host.cookie, body: createBody() });
  const { room } = (await created.json()) as { room: { code: string } };

  const joined = await call(`/api/rooms/${room.code}/join`, { method: "POST", cookie: guest.cookie });
  expect(joined.status).toBe(200);
  const joinedBody = (await joined.json()) as { room: { seats: { occupant: string | null }[] } };
  expect(joinedBody.room.seats[1]!.occupant).toBe(guest.id);

  const repeat = await call(`/api/rooms/${room.code}/join`, { method: "POST", cookie: guest.cookie });
  expect(repeat.status).toBe(409);

  const missing = await call("/api/rooms/BAKUDIRU/join", { method: "POST", cookie: guest.cookie });
  expect(missing.status).toBe(404);
});

test("PATCH /api/rooms/:code lets the host rename and set roles; others get 403", async () => {
  const host = await signUp("host@example.com");
  const guest = await signUp("guest@example.com");
  const created = await call("/api/rooms", { method: "POST", cookie: host.cookie, body: createBody() });
  const { room } = (await created.json()) as { room: { code: string } };

  const renamed = await call(`/api/rooms/${room.code}`, {
    method: "PATCH",
    cookie: host.cookie,
    body: JSON.stringify({ name: "Beta" }),
  });
  expect(renamed.status).toBe(200);
  expect(((await renamed.json()) as { room: { name: string } }).room.name).toBe("Beta");

  const denied = await call(`/api/rooms/${room.code}`, {
    method: "PATCH",
    cookie: guest.cookie,
    body: JSON.stringify({ name: "Hacked" }),
  });
  expect(denied.status).toBe(403);

  const missing = await call("/api/rooms/BAKUDIRU", {
    method: "PATCH",
    cookie: host.cookie,
    body: JSON.stringify({ name: "Beta" }),
  });
  expect(missing.status).toBe(404);
});

test("DELETE /api/rooms/:code removes the room for the host and 403 for others", async () => {
  const host = await signUp("host@example.com");
  const guest = await signUp("guest@example.com");
  const created = await call("/api/rooms", { method: "POST", cookie: host.cookie, body: createBody() });
  const { room } = (await created.json()) as { room: { code: string } };

  const denied = await call(`/api/rooms/${room.code}`, { method: "DELETE", cookie: guest.cookie });
  expect(denied.status).toBe(403);

  const removed = await call(`/api/rooms/${room.code}`, { method: "DELETE", cookie: host.cookie });
  expect(removed.status).toBe(204);

  const gone = await call(`/api/rooms/${room.code}`, { cookie: host.cookie });
  expect(gone.status).toBe(404);
});

test("GET /api/rooms/:code accepts a lowercase, hand-typed code", async () => {
  const host = await signUp("host@example.com");
  const created = await call("/api/rooms", { method: "POST", cookie: host.cookie, body: createBody() });
  const { room } = (await created.json()) as { room: { code: string } };

  const lower = await call(`/api/rooms/${room.code.toLowerCase()}`, { cookie: host.cookie });
  expect(lower.status).toBe(200);
});

test("a room created by one session is invisible to another without its code", async () => {
  const host = await signUp("host@example.com");
  await call("/api/rooms", { method: "POST", cookie: host.cookie, body: createBody() });
  const collection = await call("/api/rooms", { cookie: host.cookie });
  expect(collection.status).toBe(404);
});

const AUTH_APP_KEY = "boardgame-byc3vc";
const AUTH_HOST = "wss.vask.dev";
const TEST_SECRET = "test-secret";
const AUTH_SIGNATURE = "ea7f52379896a24c8041b2e7f1de7fca73ac10040ed1ff8667cb7096dc4cbad6";

const authEnv = (): unknown => ({
  ...harness.env,
  PUSHER_APP_KEY: AUTH_APP_KEY,
  PUSHER_HOST: AUTH_HOST,
  PUSHER_SECRET: TEST_SECRET,
});

interface StatusError {
  statusCode: number;
}

interface AuthEvent {
  readonly headers: Headers;
  readonly context: { cloudflare: { env: unknown }; request: Request };
}

const authEvent = (cookie: string | null, form: Record<string, string>, env: unknown): AuthEvent => {
  const headers = new Headers({ "content-type": "application/x-www-form-urlencoded" });
  if (cookie) headers.set("cookie", cookie);
  const request = new Request(`${ORIGIN}/api/pusher/auth`, {
    method: "POST",
    headers,
    body: new URLSearchParams(form).toString(),
  });
  return { headers: request.headers, context: { cloudflare: { env }, request } };
};

// The route is a Nitro handler: its h3 plumbing and the auth/db helpers are
// auto-import globals. Bind the real helpers and minimal stand-ins for the rest.
const loadAuthRoute = async (): Promise<(event: AuthEvent) => Promise<unknown>> => {
  vi.stubGlobal("defineEventHandler", (handler: unknown) => handler);
  vi.stubGlobal("requireSession", requireSession);
  vi.stubGlobal("cloudflareEnv", cloudflareEnv);
  vi.stubGlobal("readFormData", (event: AuthEvent) => event.context.request.formData());
  vi.stubGlobal("createError", (input: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(input.statusMessage), input),
  );
  const module = await import("../../../api/pusher/auth.post.ts");
  const handler: unknown = module.default;
  if (typeof handler !== "function") throw new Error("auth route is not a handler");
  return handler as (event: AuthEvent) => Promise<unknown>;
};

const callAuth = async (
  cookie: string | null,
  form: Record<string, string>,
  env: unknown = authEnv(),
): Promise<{ status: number; body: unknown }> => {
  const route = await loadAuthRoute();
  try {
    return { status: 200, body: await route(authEvent(cookie, form, env)) };
  } catch (error) {
    return { status: (error as StatusError).statusCode, body: null };
  }
};

test("POST /api/pusher/auth signs a private-room channel for a session", async () => {
  const host = await signUp("host@example.com");
  const response = await callAuth(host.cookie, {
    socket_id: "1234.5678",
    channel_name: "private-room-BAVOKUTI",
  });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ auth: `${AUTH_APP_KEY}:${AUTH_SIGNATURE}` });
});

test("POST /api/pusher/auth is 401 without a session", async () => {
  const response = await callAuth(null, {
    socket_id: "1234.5678",
    channel_name: "private-room-BAVOKUTI",
  });
  expect(response.status).toBe(401);
});

test("POST /api/pusher/auth is 400 for a malformed channel and never signs an arbitrary one", async () => {
  const host = await signUp("host@example.com");
  const malformed = await callAuth(host.cookie, {
    socket_id: "1234.5678",
    channel_name: "private-room-nope",
  });
  expect(malformed.status).toBe(400);

  const arbitrary = await callAuth(host.cookie, {
    socket_id: "1234.5678",
    channel_name: "private-admin",
  });
  expect(arbitrary.status).toBe(400);

  const missing = await callAuth(host.cookie, { socket_id: "1234.5678" });
  expect(missing.status).toBe(400);
});

test("POST /api/pusher/auth is 503 when realtime is not configured", async () => {
  const host = await signUp("host@example.com");
  const response = await callAuth(
    host.cookie,
    { socket_id: "1234.5678", channel_name: "private-room-BAVOKUTI" },
    harness.env,
  );
  expect(response.status).toBe(503);
});
