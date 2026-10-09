import { afterEach, expect, test, vi } from "vitest";
import { STARTER_ROLES } from "../../../../shared/core/lockstep/games/g54/roles.ts";
import { roomCode, roomId, userId } from "../../../../shared/rooms/ids.ts";
import { createRoom, type Room } from "../../../../shared/rooms/room.ts";
import type { PusherConfig } from "../../realtime/pusher.ts";
import { pusherRoomEvents } from "../pusher-events.ts";

const CONFIG: PusherConfig = {
  appKey: "boardgame-byc3vc",
  host: "wss.vask.dev",
  secret: "test-secret",
};

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

const recordingFetch = (): { calls: FetchCall[]; impl: typeof fetch } => {
  const calls: FetchCall[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response("", { status: 200 });
  }) as typeof fetch;
  return { calls, impl };
};

const room = (code: string): Room => {
  const built = createRoom({
    id: roomId("room-1"),
    code: roomCode(code),
    host: userId("user-host"),
    name: "Alpha",
    seats: 3,
    setup: { roles: STARTER_ROLES },
    now: 1000,
  });
  if (!built.ok) throw new Error(`expected a room, got ${built.error.kind}`);
  return built.value;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

test("pusherRoomEvents publishes room-changed to the private channel with the signal", async () => {
  const { calls, impl } = recordingFetch();
  vi.stubGlobal("fetch", impl);

  const events = pusherRoomEvents(CONFIG);
  await events.changed(room("BAWOLUTI"), "joined");

  expect(calls).toHaveLength(1);
  const url = new URL(calls[0]!.url);
  expect(url.host).toBe("wss.vask.dev");
  expect(url.pathname).toBe("/apps/boardgame-byc3vc/events");

  const body = JSON.parse(String(calls[0]!.init?.body)) as {
    name: string;
    channels: string[];
    data: string;
  };
  expect(body.name).toBe("room-changed");
  expect(body.channels).toEqual(["private-room-BAWOLUTI"]);
  expect(JSON.parse(body.data)).toEqual({ code: "BAWOLUTI", reason: "joined" });
});

test("pusherRoomEvents never throws when the publish fails", async () => {
  vi.stubGlobal(
    "fetch",
    (async () => {
      throw new Error("connection refused");
    }) as typeof fetch,
  );
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});

  const events = pusherRoomEvents(CONFIG);
  await expect(events.changed(room("BAWOLUTI"), "created")).resolves.toBeUndefined();

  spy.mockRestore();
});
