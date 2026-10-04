// Live proof that the D1-backed better-auth wiring works end to end.
// Boots `nuxt dev` under the cloudflare_module preset (Miniflare emulation),
// drives a real sign-up, reads the session back with the issued cookie, then
// asserts the row exists in the local D1 database via wrangler.
//
// Usage: node scripts/verify-auth.mjs
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = 3000;
const BASE = `http://localhost:${PORT}`;
const DB = "boardgame";
const EMAIL = `verify+${Date.now()}@example.com`;
const PASSWORD = "verify-password-123";

const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8" });

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

const main = async () => {
  await waitForServer();

  const signUp = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "Verify User" }),
  });
  const signUpBody = await signUp.text();
  if (signUp.status !== 200) {
    fail(`sign-up returned ${signUp.status}: ${signUpBody}`);
    return;
  }
  const { user } = JSON.parse(signUpBody);
  if (!user?.id) {
    fail(`sign-up did not return a user id: ${signUpBody}`);
    return;
  }
  const cookie = signUp.headers.get("set-cookie");
  if (!cookie) {
    fail("sign-up did not set a session cookie");
    return;
  }

  const sessionRes = await fetch(`${BASE}/api/auth/get-session`, {
    headers: { cookie },
  });
  const session = await sessionRes.json();
  if (session?.user?.email !== EMAIL) {
    fail(`get-session did not return the signed-up user: ${JSON.stringify(session)}`);
    return;
  }

  const meRes = await fetch(`${BASE}/api/me`, { headers: { cookie } });
  const me = await meRes.json();
  if (meRes.status !== 200 || me?.email !== EMAIL) {
    fail(`/api/me (requireSession) failed: ${meRes.status} ${JSON.stringify(me)}`);
    return;
  }

  const anonRes = await fetch(`${BASE}/api/me`);
  if (anonRes.status !== 401) {
    fail(`/api/me without a cookie should be 401, got ${anonRes.status}`);
    return;
  }

  const rows = d1(`SELECT email FROM user WHERE email = '${EMAIL}'`);
  const found = rows?.[0]?.results ?? [];
  if (found.length !== 1) {
    fail(`D1 has no user row for ${EMAIL}: ${JSON.stringify(rows)}`);
    return;
  }

  console.log(`PASS: signed up ${EMAIL}`);
  console.log(`PASS: get-session returned user ${session.user.id}`);
  console.log(`PASS: requireSession returned the user via /api/me, and 401 without a cookie`);
  console.log(`PASS: user row present in local D1 (${found.length} row)`);
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
