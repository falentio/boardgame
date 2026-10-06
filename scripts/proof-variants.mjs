import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3000"));
const BASE = `http://localhost:${PORT}`;
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = new URL("../.audit/variants/", import.meta.url).pathname;
const STAMP = Date.now();
const PASSWORD = "proof-password-123";
const SEATS = 5;
const VARIANTS = ["list", "roster", "grid", "chips", "stage"];
const WIDTHS = [
  { name: "375", width: 375, height: 900, mobile: true },
  { name: "1440", width: 1440, height: 900, mobile: false },
];

mkdirSync(OUT, { recursive: true });

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
};
const pass = (msg) => console.log(`PASS: ${msg}`);

const startServer = async () => {
  const server = spawn(
    "pnpm",
    ["exec", "nuxt", "dev", "--port", String(PORT), "--host", "localhost"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" } },
  );
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 180; i++) {
    try {
      const res = await fetch(`${BASE}/api/auth/ok`);
      if (res.status < 500) return { server, log: () => log };
    } catch {}
    await delay(1000);
  }
  throw new Error(`dev server never became ready:\n${log}`);
};

const signUp = async (name, slug) => {
  const email = `variant-${slug}-${STAMP}@example.com`;
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name }),
  });
  const body = await res.text();
  if (res.status !== 200) throw new Error(`sign-up ${name} returned ${res.status}: ${body}`);
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error(`sign-up ${name} set no cookie`);
  const [pair] = cookie.split(";");
  const eq = pair.indexOf("=");
  return { name, cookie: pair, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const launchBrowser = async (debugPort) => {
  const profileDir = `/tmp/proof-variants-${PORT}-${process.pid}`;
  rmSync(profileDir, { recursive: true, force: true });
  const chrome = spawn(
    "/usr/bin/google-chrome",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${debugPort}`,
      "--remote-allow-origins=*",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let wsUrl = null;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (res.ok) {
        wsUrl = (await res.json()).webSocketDebuggerUrl;
        break;
      }
    } catch {}
    await delay(250);
  }
  if (!wsUrl) throw new Error("chrome never exposed a debug endpoint");

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method && listeners.has(m.method)) {
      for (const fn of listeners.get(m.method)) fn(m.params);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });
  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(fn);
  };

  const { result: created } = await send("Target.createTarget", { url: "about:blank" });
  const { result: attached } = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const session = attached.sessionId;
  await send("Page.enable", {}, session);
  await send("Runtime.enable", {}, session);
  await send("Network.enable", {}, session);

  const page = {
    async setSessionCookie(user) {
      await send("Network.setCookie", { url: BASE, name: user.cookieName, value: user.cookieValue }, session);
    },
    async setViewport({ width, height, mobile }) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, mobile, deviceScaleFactor: 2 }, session);
    },
    async goto(url, { waitMs = 1500 } = {}) {
      const loaded = new Promise((res) => {
        on("Page.loadEventFired", () => res());
        setTimeout(res, 15000);
      });
      await send("Page.navigate", { url }, session);
      await loaded;
      await delay(waitMs);
    },
    async eval(expression) {
      const { result } = await send(
        "Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise: true },
        session,
      );
      if (result.exceptionDetails) throw new Error(`eval failed: ${result.exceptionDetails.text}`);
      return result.result.value;
    },
    async waitFor(expression, { timeoutMs = 10000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await page.eval(`!!(${expression})`)) return true;
        await delay(200);
      }
      return false;
    },
    async screenshot(name) {
      const { result } = await send("Page.captureScreenshot", { format: "png" }, session);
      const path = `${OUT}${name}.png`;
      writeFileSync(path, Buffer.from(result.data, "base64"));
      return path;
    },
  };
  return { chrome, page, close: () => chrome.kill("SIGKILL") };
};

const joinAs = async (user, code) => {
  const res = await fetch(`${BASE}/api/rooms/${code}/join`, {
    method: "POST",
    headers: { origin: BASE, cookie: user.cookie },
  });
  if (res.status !== 200) throw new Error(`join ${user.name} returned ${res.status}: ${await res.text()}`);
};

const main = async () => {
  const { server } = await startServer();
  const browser = await launchBrowser(PORT + 1);
  try {
    const host = await signUp("Amara Okonkwo", "amara");
    const guest = await signUp("Tomás Herrera", "tomas");
    const fillers = [await signUp("Priya Nair", "priya"), await signUp("Wei Zhang", "wei")];
    await browser.page.setSessionCookie(host);

    const created = await fetch(`${BASE}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, cookie: host.cookie },
      body: JSON.stringify({
        name: "Friday Coup Night",
        seats: SEATS,
        roles: ["banker", "director", "guerrilla", "politician", "peacekeeper"],
      }),
    });
    if (created.status !== 201) throw new Error(`create returned ${created.status}: ${await created.text()}`);
    const { room } = await created.json();
    await joinAs(guest, room.code);
    for (const filler of fillers) await joinAs(filler, room.code);
    pass(`seeded room ${room.code} with 4 of ${SEATS} seats filled`);

    await browser.page.setViewport(WIDTHS[0]);
    await browser.page.goto(`${BASE}/rooms/${room.code}?variant=list`);
    await browser.page.waitFor("document.querySelector('[data-seat]') !== null", { timeoutMs: 30000 });

    for (const width of WIDTHS) {
      await browser.page.setViewport(width);
      for (const variant of VARIANTS) {
        await browser.page.goto(`${BASE}/rooms/${room.code}?variant=${variant}`);
        await browser.page.waitFor("document.querySelector('.variant-picker')");
        const shown = await browser.page.waitFor(
          `document.querySelector('[data-seat]') !== null`,
          { timeoutMs: 12000 },
        );
        if (!shown) {
          fail(`${variant} @ ${width.name}: no seat row rendered`);
          continue;
        }
        const current = await browser.page.eval(
          `document.querySelector('.variant-picker [aria-current="true"]')?.dataset.variant`,
        );
        if (current !== variant) {
          fail(`${variant} @ ${width.name}: picker shows ${String(current)}`);
          continue;
        }
        const overflow = await browser.page.eval(
          `document.documentElement.scrollWidth > document.documentElement.clientWidth`,
        );
        if (overflow) fail(`${variant} @ ${width.name}: horizontal overflow`);
        const path = await browser.page.screenshot(`seat-${variant}-${width.name}`);
        pass(`${variant} @ ${width.name}px${overflow ? " (overflow!)" : ""} -> ${path}`);
      }
    }
  } finally {
    browser.close();
    server.kill("SIGTERM");
    await delay(1500);
    if (!server.killed) server.kill("SIGKILL");
  }
};

try {
  await main();
} catch (error) {
  fail(error.stack ?? error.message);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exitCode = 1;
} else {
  console.log("\nall variant checks passed");
}
