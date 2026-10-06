// Usage: node --experimental-strip-types scripts/verify-game.mjs [--port 3000]
import { setTimeout as delay } from "node:timers/promises";
import { g54 } from "../shared/core/lockstep/games/g54/index.ts";
import { act } from "../shared/core/lockstep/index.ts";
import { genesisFor, openGameSession } from "../shared/game/index.ts";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3000"));
const BASE = `http://localhost:${PORT}`;
const APP_KEY = "boardgame-byc3vc";
const HOST = "wss.vask.dev";
const ROLES = ["banker", "director", "guerrilla", "politician", "peacekeeper"];
const STAMP = Date.now();

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`FAIL: ${msg}`);
};
const pass = (msg) => console.log(`PASS: ${msg}`);

const waitUntil = async (predicate, timeoutMs, label) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(50);
  }
  throw new Error(`timed out waiting for ${label}`);
};

const signUp = async (label) => {
  const email = `game-${label}-${STAMP}@example.com`;
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

const openPeer = async (code, cookie) => {
  const channelName = `private-game-${code}`;
  let onMessage = () => {};
  let onConnected = () => {};
  const subscribed = new Promise((resolve) => (onConnected = resolve));

  const ws = new WebSocket(`wss://${HOST}/app/${APP_KEY}?protocol=7&client=js&version=8.6.0`);
  ws.onmessage = async (event) => {
    const message = JSON.parse(String(event.data));
    if (message.event === "pusher:connection_established") {
      const socketId = JSON.parse(message.data).socket_id;
      const authRes = await fetch(`${BASE}/api/pusher/auth`, {
        method: "POST",
        headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ socket_id: socketId, channel_name: channelName }).toString(),
      });
      if (authRes.status !== 200) {
        throw new Error(`game channel auth returned ${authRes.status}: ${await authRes.text()}`);
      }
      const { auth } = await authRes.json();
      ws.send(JSON.stringify({ event: "pusher:subscribe", data: { auth, channel: channelName } }));
      return;
    }
    if (message.event === "pusher_internal:subscription_succeeded") {
      onConnected();
      return;
    }
    if (message.event === "game") {
      onMessage(JSON.parse(message.data));
    }
  };

  const channel = {
    subscribe(handlers) {
      onMessage = handlers.onMessage;
      const wasConnected = onConnected;
      onConnected = () => {
        wasConnected();
        handlers.onConnected();
      };
      return () => ws.close();
    },
    publish(envelope) {
      void fetch(`${BASE}/api/rooms/${code}/game`, {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(envelope),
      }).then(async (res) => {
        if (res.status !== 204) fail(`relay returned ${res.status}: ${await res.text()}`);
      });
    },
  };

  await subscribed;
  return channel;
};

const main = async () => {
  const host = await signUp("host");
  const guest = await signUp("guest");

  const created = await api("/api/rooms", {
    method: "POST",
    cookie: host.cookie,
    body: JSON.stringify({ name: "Bridge Proof", seats: 2, roles: ROLES }),
  });
  const createdBody = await created.text();
  if (created.status !== 201) throw new Error(`create returned ${created.status}: ${createdBody}`);
  const room = JSON.parse(createdBody).room;
  pass(`created room ${room.code}`);

  const joined = await api(`/api/rooms/${room.code}/join`, { method: "POST", cookie: guest.cookie });
  if (joined.status !== 200) throw new Error(`join returned ${joined.status}`);
  const full = JSON.parse(await (await api(`/api/rooms/${room.code}`, { cookie: host.cookie })).text()).room;

  const hostSeat = full.seats.find((s) => s.occupant === host.id);
  const guestSeat = full.seats.find((s) => s.occupant === guest.id);
  if (!hostSeat || !guestSeat) throw new Error("both seats must be occupied");
  pass(`both peers seated (host ${hostSeat.id}, guest ${guestSeat.id})`);

  const genesis = genesisFor({ code: room.code, roles: ROLES, seats: full.seats });

  const hostChannel = await openPeer(room.code, host.cookie);
  pass(`host subscribed to private-game-${room.code} over a real WebSocket`);
  const guestChannel = await openPeer(room.code, guest.cookie);
  pass(`guest subscribed to private-game-${room.code} over a real WebSocket`);

  const hostSession = openGameSession({
    game: g54,
    channel: hostChannel,
    seat: hostSeat.id,
    genesis,
    clock: { now: () => Date.now() },
    inputTimeoutMs: 60000,
  });
  const guestSession = openGameSession({
    game: g54,
    channel: guestChannel,
    seat: guestSeat.id,
    genesis,
    clock: { now: () => Date.now() },
    inputTimeoutMs: 60000,
  });

  hostSession.session.report(act({ t: "income" }));
  pass("host published a report through the relay");

  await waitUntil(() => guestSession.session.frame >= 1, 15000, "guest to fold the host report");
  pass("guest folded the host report");

  guestSession.session.report(act({ t: "pass" }));
  pass("guest answered through the relay");

  await waitUntil(() => hostSession.session.frame >= 2, 15000, "host to fold the guest report");
  await waitUntil(() => guestSession.session.frame >= 2, 15000, "guest to fold the sealed frame");

  if (hostSession.session.frame !== guestSession.session.frame) {
    fail(`frames diverged: host ${hostSession.session.frame}, guest ${guestSession.session.frame}`);
  } else {
    pass(`both peers converged at frame ${hostSession.session.frame}`);
  }

  const hostView = hostSession.session.view();
  const guestView = guestSession.session.view();
  if (hostView.active !== guestView.active) {
    fail(`active seat diverged: ${hostView.active} vs ${guestView.active}`);
  } else {
    pass(`both peers agree the active seat is ${hostView.active}`);
  }
  if (JSON.stringify(hostView.players) !== JSON.stringify(guestView.players)) {
    fail("public player projections diverged");
  } else {
    pass("both peers agree on the public player projections");
  }

  hostSession.close();
  guestSession.close();
};

try {
  await main();
} catch (error) {
  fail(error.message);
}
if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exitCode = 1;
} else {
  console.log("\nall assertions passed");
}
