import { afterEach, beforeEach, expect, test } from "vitest";
import { makeRandom } from "../../../../shared/core/lockstep/hash.ts";
import { seed } from "../../../../shared/core/lockstep/ids.ts";
import { CODE_SPACE_SIZE } from "../../../../shared/rooms/code.ts";
import { roomId } from "../../../../shared/rooms/ids.ts";
import * as roomDomain from "../../../../shared/rooms/index.ts";
import { authFromEnv } from "../../../utils/auth.ts";
import { createRoomApp } from "../http.ts";
import * as store from "../store.ts";
import { createTestDb, type TestDb } from "./d1-harness.ts";
import { recordingEvents, recordingGameEvents } from "./recording-events.ts";

const ORIGIN = "http://localhost:3000";

let harness: TestDb;
let app: ReturnType<typeof createRoomApp>;

beforeEach(async () => {
  harness = await createTestDb();
  app = createRoomApp({
    db: harness.db,
    auth: authFromEnv(harness.env),
    entropy: makeRandom(seed("00000000000000ff")),
    newId: () => roomId("room-1"),
    now: () => 1000,
    events: recordingEvents().events,
    gameEvents: recordingGameEvents().gameEvents,
  });
});

afterEach(async () => {
  await harness.dispose();
});

const ALLOWED_ROUTES: readonly string[] = [
  "POST /api/rooms",
  "GET /api/rooms/:code",
  "POST /api/rooms/:code/join",
  "POST /api/rooms/:code/leave",
  "POST /api/rooms/:code/kick",
  "POST /api/rooms/:code/game",
  "PATCH /api/rooms/:code",
  "DELETE /api/rooms/:code",
];

test("the route table is exactly the allow-list, with no collection read", () => {
  const actual = app.routes
    .filter((route) => route.method !== "ALL")
    .map((route) => `${route.method} ${route.path}`)
    .sort();
  expect(actual).toEqual([...ALLOWED_ROUTES].sort());
  expect(app.routes.some((route) => route.method === "GET" && route.path === "/api/rooms")).toBe(
    false,
  );
});

test("GET /api/rooms is a 404: there is no list route to enumerate rooms", async () => {
  const response = await app.fetch(new Request(`${ORIGIN}/api/rooms`));
  expect(response.status).toBe(404);
});

test("the store export set is frozen to the named operations, with no list", () => {
  const exports = Object.keys(store).sort();
  expect(exports).toEqual([
    "deleteExpiredRooms",
    "insertRoom",
    "removeRoom",
    "removeRoomIf",
    "roomByCode",
    "saveRoom",
  ]);
  for (const name of exports) {
    expect(name.toLowerCase()).not.toContain("list");
    expect(name.toLowerCase()).not.toContain("all");
    expect(name.toLowerCase()).not.toContain("scan");
  }
});

test("the pure domain exposes no storage capability", () => {
  for (const name of Object.keys(roomDomain)) {
    expect(name.toLowerCase()).not.toContain("store");
    expect(name.toLowerCase()).not.toContain("db");
    expect(name.toLowerCase()).not.toContain("list");
  }
});

test("the code space is large enough that enumeration is infeasible", () => {
  expect(CODE_SPACE_SIZE).toBe(121_550_625);
  expect(CODE_SPACE_SIZE).toBeGreaterThan(100_000_000);
});
