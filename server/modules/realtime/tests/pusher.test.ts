import { expect, test } from "vitest";
import { pusherConfigFromEnv } from "../config.ts";
import {
  channelAuth,
  pusherPublisher,
  signTrigger,
  type PusherConfig,
} from "../pusher.ts";

const CONFIG: PusherConfig = {
  appKey: "boardgame-byc3vc",
  host: "wss.vask.dev",
  secret: "test-secret",
};

const NOW = 1700000000;
const BODY =
  '{"name":"room-changed","channels":["private-room-BAWOLUTI"],"data":"{\\"code\\":\\"BAWOLUTI\\",\\"reason\\":\\"joined\\"}"}';
const GOLDEN_URL =
  "https://wss.vask.dev/apps/boardgame-byc3vc/events?auth_key=boardgame-byc3vc&auth_timestamp=1700000000&auth_version=1.0&body_md5=7c4accf3870a237d48ae092f2da712d3&auth_signature=61e74516a7ae0c372bdd0227ea0dab0f3f0cab578c3b110586c8c276e592fd91";

interface FetchCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

const recordingFetch = (
  respond: () => Response = () => new Response("", { status: 200 }),
): { calls: FetchCall[]; impl: typeof fetch } => {
  const calls: FetchCall[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return respond();
  }) as typeof fetch;
  return { calls, impl };
};

test("signTrigger produces the frozen golden request for a fixed body and clock", () => {
  const request = signTrigger(CONFIG, BODY, NOW);
  expect(request.url).toBe(GOLDEN_URL);
  expect(request.method).toBe("POST");
  expect(request.body).toBe(BODY);
  expect(request.headers).toEqual({ "content-type": "application/json" });
});

test("signTrigger signs the query in the auth_key, timestamp, version, body_md5 order", () => {
  const request = signTrigger(CONFIG, BODY, NOW);
  const query = new URL(request.url).search;
  const keys = [...query.slice(1).split("&")].map((pair) => pair.split("=")[0]);
  expect(keys).toEqual([
    "auth_key",
    "auth_timestamp",
    "auth_version",
    "body_md5",
    "auth_signature",
  ]);
});

test("channelAuth signs <socket_id>:<channel> as <appKey>:<hmac>", () => {
  expect(channelAuth(CONFIG, "1234.5678", "private-room-BAWOLUTI")).toEqual({
    auth: "boardgame-byc3vc:0424f7ed3545da0b496ede7f9a1ac6b48502008da77a8e25683fd2e38e975c72",
  });
});

test("pusherPublisher posts the signed trigger to the channel and event", async () => {
  const { calls, impl } = recordingFetch();
  const publish = pusherPublisher(CONFIG, { fetch: impl, now: () => NOW });
  await publish("private-room-BAWOLUTI", "room-changed", { code: "BAWOLUTI", reason: "joined" });

  expect(calls).toHaveLength(1);
  const call = calls[0]!;
  expect(call.url).toBe(GOLDEN_URL);
  expect(call.init?.method).toBe("POST");
  expect(call.init?.body).toBe(BODY);
});

test("pusherPublisher swallows a non-2xx response and logs it", async () => {
  const { impl } = recordingFetch(() => new Response("Invalid body_md5", { status: 400 }));
  const logged: string[] = [];
  const publish = pusherPublisher(CONFIG, {
    fetch: impl,
    now: () => NOW,
    log: (message) => logged.push(message),
  });

  await expect(
    publish("private-room-BAWOLUTI", "room-changed", { code: "BAWOLUTI", reason: "joined" }),
  ).resolves.toBeUndefined();
  expect(logged).toHaveLength(1);
  expect(logged[0]).toContain("400");
});

test("pusherPublisher swallows a network error and logs it", async () => {
  const impl = (async () => {
    throw new Error("connection refused");
  }) as typeof fetch;
  const logged: string[] = [];
  const publish = pusherPublisher(CONFIG, {
    fetch: impl,
    now: () => NOW,
    log: (message) => logged.push(message),
  });

  await expect(
    publish("private-room-BAWOLUTI", "room-changed", { code: "BAWOLUTI", reason: "joined" }),
  ).resolves.toBeUndefined();
  expect(logged).toHaveLength(1);
});

test("pusherPublisher aborts a hung request at the timeout and swallows it", async () => {
  let sawSignal = false;
  const impl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    sawSignal = init?.signal instanceof AbortSignal;
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    });
  }) as typeof fetch;
  const logged: string[] = [];
  const publish = pusherPublisher(CONFIG, {
    fetch: impl,
    now: () => NOW,
    timeoutMs: 20,
    log: (message) => logged.push(message),
  });

  await expect(
    publish("private-room-BAWOLUTI", "room-changed", { code: "BAWOLUTI", reason: "joined" }),
  ).resolves.toBeUndefined();
  expect(sawSignal).toBe(true);
  expect(logged).toHaveLength(1);
});

test("pusherConfigFromEnv returns the config when every var is present", () => {
  expect(
    pusherConfigFromEnv({
      PUSHER_APP_KEY: "boardgame-byc3vc",
      PUSHER_HOST: "wss.vask.dev",
      PUSHER_SECRET: "test-secret",
    }),
  ).toEqual(CONFIG);
});

test("pusherConfigFromEnv returns null when any var is missing", () => {
  const full = {
    PUSHER_APP_KEY: "boardgame-byc3vc",
    PUSHER_HOST: "wss.vask.dev",
    PUSHER_SECRET: "test-secret",
  };
  expect(pusherConfigFromEnv({ ...full, PUSHER_APP_KEY: undefined })).toBeNull();
  expect(pusherConfigFromEnv({ ...full, PUSHER_HOST: undefined })).toBeNull();
  expect(pusherConfigFromEnv({ ...full, PUSHER_SECRET: undefined })).toBeNull();
  expect(pusherConfigFromEnv({})).toBeNull();
});
