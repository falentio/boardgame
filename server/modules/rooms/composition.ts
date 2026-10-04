import type { Hono } from "hono";
import type { RoomEvents } from "../../../shared/rooms/events.ts";
import { roomId } from "../../../shared/rooms/ids.ts";
import { authFromEnv } from "../../utils/auth.ts";
import { dbFromEnv, type CloudflareEnv } from "../../utils/db.ts";
import { pusherConfigFromEnv } from "../realtime/config.ts";
import { cryptoEntropy } from "./code-source.ts";
import { createRoomApp } from "./http.ts";
import { pusherRoomEvents } from "./pusher-events.ts";

const noopEvents: RoomEvents = { changed: async () => {} };

// Keyed by the env object, which is immutable for an isolate's lifetime, so a
// cached app can never go stale.
const appCache = new WeakMap<CloudflareEnv, Hono>();

export const roomAppFor = (env: CloudflareEnv): Hono => {
  let app = appCache.get(env);
  if (!app) {
    const config = pusherConfigFromEnv(env);
    app = createRoomApp({
      db: dbFromEnv(env),
      auth: authFromEnv(env),
      entropy: cryptoEntropy(),
      newId: () => roomId(crypto.randomUUID()),
      now: () => Date.now(),
      events: config ? pusherRoomEvents(config) : noopEvents,
    });
    appCache.set(env, app);
  }
  return app;
};
