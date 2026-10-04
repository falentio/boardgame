// Usage: node scripts/verify-rooms.mjs
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = 3000;
const BASE = `http://localhost:${PORT}`;
const DB = "boardgame";
const ROLES = ["banker", "director", "guerrilla", "politician", "peacekeeper"];
const STAMP = Date.now();

const run = (cmd, args) => spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8" });

const d1 = (sql) => {
  const r = run("pnpm", [
    "exec",
    "wrangler",
    "d1",
    "execute",
    DB,
    "--local",
    "--json",
    "--command",
    sql,
  ]);
  if (r.status !== 0) throw new Error(`d1 execute failed:\n${r.stdout}\n${r.stderr}`);
  return JSON.parse(r.stdout);
};

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
  const email = `rooms-${label}-${STAMP}@example.com`;
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: "verify-password-123", name: label }),
  });
  const body = await res.text();
  if (res.status !== 200) throw new Error(`sign-up ${label} returned ${res.status}: ${body}`);
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error(`sign-up ${label} set no cookie`);
  const { user } = JSON.parse(body);
  return { email, cookie, id: user.id };
};

const api = (path, init = {}) => {
  const { cookie, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (cookie) headers.set("cookie", cookie);
  if (rest.body) headers.set("content-type", "application/json");
  return fetch(`${BASE}${path}`, { ...rest, headers });
};

const main = async () => {
  await waitForServer();

  const host = await signUp("host");
  const guest = await signUp("guest");

  const anon = await api("/api/rooms", { method: "POST", body: JSON.stringify({ seats: 3, roles: ROLES }) });
  if (anon.status !== 401) return fail(`anonymous create should be 401, got ${anon.status}`);

  const created = await api("/api/rooms", {
    method: "POST",
    cookie: host.cookie,
    body: JSON.stringify({ name: "Live Room", seats: 3, roles: ROLES }),
  });
  const createdBody = await created.text();
  if (created.status !== 201) return fail(`create returned ${created.status}: ${createdBody}`);
  const { room } = JSON.parse(createdBody);
  if (!room?.code || room.code.length !== 8) return fail(`create returned no code: ${createdBody}`);
  if (room.host !== host.id) return fail(`create returned the wrong host: ${createdBody}`);
  if (room.link !== `${BASE}/join/${room.code}`) return fail(`create returned the wrong link: ${createdBody}`);
  if (room.seats[0]?.occupant !== host.id) return fail(`host is not seated at position 0: ${createdBody}`);
  console.log(`PASS: created room ${room.code} for host ${host.id}`);

  const collection = await api("/api/rooms", { cookie: host.cookie });
  if (collection.status !== 404) return fail(`GET /api/rooms should be 404, got ${collection.status}`);
  console.log("PASS: no collection route: GET /api/rooms is 404");

  const fetched = await api(`/api/rooms/${room.code}`, { cookie: host.cookie });
  if (fetched.status !== 200) return fail(`read returned ${fetched.status}`);
  console.log(`PASS: read room ${room.code} by its exact code`);

  const missing = await api("/api/rooms/BAKUDIRU", { cookie: host.cookie });
  if (missing.status !== 404) return fail(`unknown code should be 404, got ${missing.status}`);
  console.log("PASS: an unknown code is 404 (reachable only by holding the code)");

  const joined = await api(`/api/rooms/${room.code}/join`, { method: "POST", cookie: guest.cookie });
  const joinedBody = await joined.text();
  if (joined.status !== 200) return fail(`join returned ${joined.status}: ${joinedBody}`);
  const joinedRoom = JSON.parse(joinedBody).room;
  if (joinedRoom.seats[1]?.occupant !== guest.id) return fail(`guest not seated: ${joinedBody}`);
  console.log(`PASS: guest ${guest.id} joined into seat 1`);

  const repeat = await api(`/api/rooms/${room.code}/join`, { method: "POST", cookie: guest.cookie });
  if (repeat.status !== 409) return fail(`repeat join should be 409, got ${repeat.status}`);
  console.log("PASS: a repeat join is 409");

  const renamed = await api(`/api/rooms/${room.code}`, {
    method: "PATCH",
    cookie: host.cookie,
    body: JSON.stringify({ name: "Renamed Live Room" }),
  });
  const renamedBody = await renamed.text();
  if (renamed.status !== 200) return fail(`patch returned ${renamed.status}: ${renamedBody}`);
  if (JSON.parse(renamedBody).room.name !== "Renamed Live Room") return fail(`patch did not rename: ${renamedBody}`);

  const denied = await api(`/api/rooms/${room.code}`, {
    method: "PATCH",
    cookie: guest.cookie,
    body: JSON.stringify({ name: "Hijacked" }),
  });
  if (denied.status !== 403) return fail(`non-host patch should be 403, got ${denied.status}`);
  console.log("PASS: the host renamed the room; a non-host patch is 403");

  const removed = await api(`/api/rooms/${room.code}`, { method: "DELETE", cookie: host.cookie });
  if (removed.status !== 204) return fail(`delete returned ${removed.status}`);
  const gone = await api(`/api/rooms/${room.code}`, { cookie: host.cookie });
  if (gone.status !== 404) return fail(`deleted room should be 404, got ${gone.status}`);
  console.log("PASS: the host deleted the room; it is now 404");

  const rows = d1(`SELECT code FROM room WHERE code = '${room.code}'`);
  const found = rows?.[0]?.results ?? [];
  if (found.length !== 0) return fail(`D1 still has a row for ${room.code}: ${JSON.stringify(rows)}`);
  console.log("PASS: the deleted room left no row in local D1");
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
