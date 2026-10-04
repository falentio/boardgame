// Usage: node scripts/verify-realtime.mjs
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = 3000;
const BASE = `http://localhost:${PORT}`;
const ROLES = ["banker", "director", "guerrilla", "politician", "peacekeeper"];
const APP_KEY = "boardgame-byc3vc";
const HOST = "wss.vask.dev";
const STAMP = Date.now();

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};

const dev = spawn("pnpm", ["exec", "nuxt", "dev", "--port", String(PORT)], {
  cwd: ROOT,
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_ENV: "development" },
});

let serverLog = "";
dev.stdout.on("data", (d) => (serverLog += d));
dev.stderr.on("data", (d) => (serverLog += d));

const waitForServer = async () => {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${BASE}/api/auth/ok`);
      if (res.status < 500) return;
    } catch {}
    await delay(1000);
  }
  throw new Error(`dev server never became ready.\n${serverLog}`);
};

const signUp = async (label) => {
  const email = `realtime-${label}-${STAMP}@example.com`;
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: "verify-password-123", name: label }),
  });
  const body = await res.text();
  if (res.status !== 200) throw new Error(`sign-up ${label} returned ${res.status}: ${body}`);
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error(`sign-up ${label} set no cookie`);
  return { cookie, id: JSON.parse(body).user.id };
};

const api = (path, init = {}) => {
  const { cookie, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (cookie) headers.set("cookie", cookie);
  if (rest.body) headers.set("content-type", "application/json");
  return fetch(`${BASE}${path}`, { ...rest, headers });
};

const openSubscription = (code, cookie, expectedReason) => {
  const channel = `private-room-${code}`;
  let resolveReady;
  let rejectReady;
  let resolveChanged;
  let rejectChanged;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const changed = new Promise((resolve, reject) => {
    resolveChanged = resolve;
    rejectChanged = reject;
  });
  // Both reject on abort; main may await only one of them, so mark both handled.
  ready.catch(() => {});
  changed.catch(() => {});

  const ws = new WebSocket(`wss://${HOST}/app/${APP_KEY}?protocol=7&client=js&version=8.6.0`);
  const abort = (error) => {
    ws.close();
    rejectReady(error);
    rejectChanged(error);
  };
  const timer = setTimeout(
    () => abort(new Error(`timed out waiting for a room-changed with reason ${expectedReason}`)),
    20000,
  );

  ws.onerror = () => abort(new Error("websocket error"));
  ws.onmessage = async (event) => {
    const message = JSON.parse(String(event.data));
    if (message.event === "pusher:connection_established") {
      const { socket_id: socketId } = JSON.parse(message.data);
      const authRes = await fetch(`${BASE}/api/pusher/auth`, {
        method: "POST",
        headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ socket_id: socketId, channel_name: channel }).toString(),
      });
      const authBody = await authRes.text();
      if (authRes.status !== 200) {
        return abort(new Error(`auth route returned ${authRes.status}: ${authBody}`));
      }
      const { auth } = JSON.parse(authBody);
      if (!String(auth).startsWith(`${APP_KEY}:`)) {
        return abort(new Error(`auth is not signed for the app key: ${authBody}`));
      }
      ws.send(JSON.stringify({ event: "pusher:subscribe", data: { auth, channel } }));
      return;
    }
    if (message.event === "pusher_internal:subscription_succeeded") {
      resolveReady();
      return;
    }
    if (message.event === "room-changed") {
      const signal = JSON.parse(message.data);
      // A signal published just before we subscribed can still land; wait for
      // the one this mutation caused.
      if (signal.reason !== expectedReason) return;
      clearTimeout(timer);
      resolveChanged(signal);
      ws.close();
    }
  };

  return { ready, changed };
};

const main = async () => {
  await waitForServer();

  const host = await signUp("host");
  const guest = await signUp("guest");

  const created = await api("/api/rooms", {
    method: "POST",
    cookie: host.cookie,
    body: JSON.stringify({ name: "Realtime Room", seats: 3, roles: ROLES }),
  });
  const createdBody = await created.text();
  if (created.status !== 201) return fail(`create returned ${created.status}: ${createdBody}`);
  const { room } = JSON.parse(createdBody);
  console.log(`PASS: created room ${room.code}`);

  const anonAuth = await fetch(`${BASE}/api/pusher/auth`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ socket_id: "1.2", channel_name: `private-room-${room.code}` }).toString(),
  });
  if (anonAuth.status !== 401) return fail(`anonymous auth should be 401, got ${anonAuth.status}`);
  console.log("PASS: /api/pusher/auth is 401 without a session");

  const badAuth = await fetch(`${BASE}/api/pusher/auth`, {
    method: "POST",
    headers: { cookie: host.cookie, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ socket_id: "1.2", channel_name: "private-admin" }).toString(),
  });
  if (badAuth.status !== 400) return fail(`malformed channel auth should be 400, got ${badAuth.status}`);
  console.log("PASS: /api/pusher/auth refuses a non-room channel with 400");

  const subscription = openSubscription(room.code, host.cookie, "joined");
  await subscription.ready;
  console.log(`PASS: subscribed to private-room-${room.code} over a real WebSocket`);

  const joined = await api(`/api/rooms/${room.code}/join`, { method: "POST", cookie: guest.cookie });
  if (joined.status !== 200) return fail(`join returned ${joined.status}`);

  const signal = await subscription.changed;
  if (signal.code !== room.code) return fail(`signal code mismatch: ${JSON.stringify(signal)}`);
  if (signal.reason !== "joined") return fail(`signal reason should be joined: ${JSON.stringify(signal)}`);
  console.log(`PASS: room-changed arrived with signal ${JSON.stringify(signal)} (no room data on the wire)`);

  const refetched = await api(`/api/rooms/${room.code}`, { cookie: host.cookie });
  const refetchedBody = await refetched.text();
  if (refetched.status !== 200) return fail(`refetch returned ${refetched.status}`);
  const refetchedRoom = JSON.parse(refetchedBody).room;
  if (refetchedRoom.seats[1]?.occupant !== guest.id) {
    return fail(`refetch does not reflect the join: ${refetchedBody}`);
  }
  console.log(`PASS: the following GET reflects the change (guest ${guest.id} seated)`);
};

try {
  await main();
} catch (error) {
  fail(error.message);
} finally {
  dev.kill("SIGTERM");
  await delay(1500);
  if (!dev.killed) dev.kill("SIGKILL");
}
