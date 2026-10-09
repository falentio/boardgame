import { afterEach, expect, test, vi } from "vitest";
import { encodeEnvelope } from "../../../../shared/game/events.ts";
import { roomCode } from "../../../../shared/rooms/ids.ts";
import type { PusherConfig } from "../../realtime/pusher.ts";
import { pusherGameEvents } from "../relay.ts";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

test("pusherGameEvents publishes the envelope as game to the private game channel", async () => {
  const { calls, impl } = recordingFetch();
  vi.stubGlobal("fetch", impl);

  const events = pusherGameEvents(CONFIG);
  await events.published(roomCode("BAWOLUTI"), encodeEnvelope({ kind: "sync" }));

  expect(calls).toHaveLength(1);
  const url = new URL(calls[0]!.url);
  expect(url.host).toBe("wss.vask.dev");
  expect(url.pathname).toBe("/apps/boardgame-byc3vc/events");

  const body = JSON.parse(String(calls[0]!.init?.body)) as {
    name: string;
    channels: string[];
    data: string;
  };
  expect(body.name).toBe("game");
  expect(body.channels).toEqual(["private-game-BAWOLUTI"]);
  expect(JSON.parse(body.data)).toEqual({ v: 1, body: { kind: "sync" } });
});
