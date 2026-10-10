// Live proof that a picked window-picker row wraps instead of clamping. Builds a
// real 2-seat game over the API, opens the host's turn window, and measures the
// reason span on a long-summary row: unpicked it clamps to one line (nowrap,
// scrollWidth past clientWidth); picked it wraps (normal, no horizontal clip) and
// the row grows taller. Screenshots both states.
//
// Usage: node scripts/proof-picker-wrap.mjs [--port 3210] [--out DIR] [--keep]
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { STARTER_ROLES } from "../shared/core/lockstep/games/g54/roles.ts";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3210"));
const KEEP = args.includes("--keep");
const BASE = `http://localhost:${PORT}`;
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = argOf("--out", new URL("../.audit/proof/", import.meta.url).pathname);
const STAMP = Date.now();
const PASSWORD = "proof-password-123";

mkdirSync(OUT, { recursive: true });

const failures = [];
const fail = (msg) => { failures.push(msg); console.error(`FAIL: ${msg}`); };
const pass = (msg) => console.log(`PASS: ${msg}`);
const info = (msg) => console.log(`INFO: ${msg}`);

const serverAnswers = async () => {
  try {
    const res = await fetch(`${BASE}/api/auth/ok`);
    return res.ok;
  } catch {
    return false;
  }
};

const startServer = async () => {
  if (await serverAnswers()) return { server: null, reused: true };
  const server = spawn(
    "pnpm",
    ["exec", "nuxt", "dev", "--port", String(PORT), "--host", "localhost"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" } },
  );
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 180; i++) {
    if (await serverAnswers()) return { server, reused: false };
    await delay(1000);
  }
  throw new Error(`dev server never became ready:\n${log}`);
};

const signUp = async (label) => {
  const email = `wrap-${label}-${STAMP}@example.com`;
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name: label }),
  });
  const body = await res.text();
  if (res.status !== 200) throw new Error(`sign-up ${label} returned ${res.status}: ${body}`);
  const { user } = JSON.parse(body);
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error(`sign-up ${label} set no cookie`);
  const [pair] = cookie.split(";");
  const eq = pair.indexOf("=");
  return { id: user.id, email, name: label, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const launchBrowser = async (label, debugPort) => {
  const profileDir = `/tmp/proof-wrap-${label}-${PORT}-${process.pid}`;
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
      if (res.ok) { wsUrl = (await res.json()).webSocketDebuggerUrl; break; }
    } catch {}
    await delay(250);
  }
  if (!wsUrl) throw new Error(`${label}: chrome never exposed a debug endpoint`);

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method && listeners.has(m.method)) for (const fn of listeners.get(m.method)) fn(m.params);
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const on = (method, fn) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(fn); };

  const { result: created } = await send("Target.createTarget", { url: "about:blank" });
  const { result: attached } = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const session = attached.sessionId;
  await send("Page.enable", {}, session);
  await send("Runtime.enable", {}, session);
  await send("Network.enable", {}, session);

  const page = {
    async setViewport(width, height) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, session);
      await delay(200);
    },
    async setSessionCookie(user) {
      await send("Network.setCookie", { url: BASE, name: user.cookieName, value: user.cookieValue }, session);
    },
    async goto(url, { waitMs = 1500 } = {}) {
      const loaded = new Promise((res) => { on("Page.loadEventFired", () => res()); setTimeout(res, 15000); });
      await send("Page.navigate", { url }, session);
      await loaded;
      await delay(waitMs);
    },
    async eval(expression) {
      const msg = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, session);
      if (msg.error) throw new Error(`eval error: ${JSON.stringify(msg.error)}`);
      if (msg.result.exceptionDetails) throw new Error(`eval failed: ${msg.result.exceptionDetails.text}`);
      return msg.result.result.value;
    },
    async url() { return page.eval("location.pathname"); },
    async bodyText() { return page.eval("document.body.innerText"); },
    async waitFor(expression, { timeoutMs = 8000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) { if (await page.eval(`!!(${expression})`)) return true; await delay(200); }
      return false;
    },
    async waitForHydration({ timeoutMs = 30000 } = {}) {
      const ok = await page.waitFor("!!(document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__)", { timeoutMs });
      if (!ok) throw new Error("Vue never hydrated");
      return true;
    },
    async rectOf(jsEl) {
      return page.eval(`(() => { const el = ${jsEl}; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, disabled: !!el.disabled }; })()`);
    },
    async mouseClick(x, y) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 }, session);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 }, session);
      await delay(40);
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 }, session);
    },
    async clickReal(jsEl, { attempts = 6, settleMs = 350 } = {}) {
      for (let i = 0; i < attempts; i++) {
        const rect = await page.rectOf(jsEl);
        if (rect === null) { await delay(250); continue; }
        if (rect.disabled) { await delay(250); continue; }
        await delay(60);
        await page.mouseClick(rect.x, rect.y);
        await delay(settleMs);
        return true;
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

const ROW = (name) =>
  `[...document.querySelectorAll('[data-slot=window-picker] .picker-row')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`;

const reasonProbe = (name) => `(() => {
  const row = ${ROW(name)};
  if (!row) return null;
  const wrapper = row.querySelector('span.min-w-0');
  const [, reason] = [...wrapper.querySelectorAll(':scope > span')];
  if (!reason) return null;
  const cs = getComputedStyle(reason);
  const r = reason.getBoundingClientRect();
  return {
    selected: row.getAttribute('aria-pressed') === 'true',
    whiteSpace: cs.whiteSpace,
    overflow: cs.overflow,
    textOverflow: cs.textOverflow,
    scrollWidth: reason.scrollWidth,
    clientWidth: reason.clientWidth,
    clipped: reason.scrollWidth > reason.clientWidth + 1,
    height: Math.round(r.height),
    text: reason.textContent.trim(),
  };
})()`;

const main = async () => {
  const { server, reused } = await startServer();
  if (reused) console.warn("note: reusing an already-running dev server; not validated as this checkout");
  const host = await signUp("host");
  const guest = await signUp("guest");
  pass(`created accounts ${host.email} and ${guest.email}`);

  const browser = await launchBrowser("host", PORT + 61);
  try {
    await browser.page.setViewport(430, 900);
    await browser.page.setSessionCookie(host);

    const cookie = `${host.cookieName}=${host.cookieValue}`;
    const created = await fetch(`${BASE}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, cookie },
      body: JSON.stringify({ seats: 2, roles: STARTER_ROLES, name: "wrap proof" }),
    });
    if (!created.ok) throw new Error(`room create returned ${created.status}: ${await created.text()}`);
    const code = (await created.json()).room.code;
    pass(`host created room ${code}`);

    const joined = await fetch(`${BASE}/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, cookie: `${guest.cookieName}=${guest.cookieValue}` },
    });
    if (!joined.ok) throw new Error(`guest join returned ${joined.status}: ${await joined.text()}`);

    const started = await fetch(`${BASE}/api/rooms/${code}/start`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, cookie },
    });
    if (!started.ok) throw new Error(`start returned ${started.status}: ${await started.text()}`);

    await browser.page.goto(`${BASE}/games/${code}`, { waitMs: 2500 });
    await browser.page.waitForHydration();
    const board = await browser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    if (!board) throw new Error("the board never rendered");

    const turn = await browser.page.waitFor("!!document.querySelector('[data-slot=window-picker]')", { timeoutMs: 20000 });
    if (!turn) throw new Error(`host turn window never opened; body: ${(await browser.page.bodyText()).replace(/\n/g, " | ")}`);
    pass("host turn window is open");

    const candidates = await browser.page.eval(`(() => {
      const rows = [...document.querySelectorAll('[data-slot=window-picker] .picker-row')];
      return rows.map((b) => {
        const reason = [...b.querySelector('span.min-w-0').querySelectorAll(':scope > span')][1];
        return { label: (b.getAttribute('aria-label') || '').split('.')[0], len: reason ? reason.textContent.trim().length : 0 };
      }).sort((a, b) => b.len - a.len);
    })()`);
    info(`row reasons by length: ${JSON.stringify(candidates)}`);
    const target = candidates[0];
    if (!target || target.len < 30) throw new Error(`no long-summary row to test; got ${JSON.stringify(candidates)}`);

    const before = await browser.page.eval(reasonProbe(target.label));
    info(`unpicked "${target.label}": ${JSON.stringify(before)}`);
    if (before === null) throw new Error(`could not read the reason span for ${target.label}`);
    if (before.selected) fail(`${target.label} is already picked before the click`);
    if (before.whiteSpace !== "nowrap") fail(`an unpicked row must clamp: white-space=${before.whiteSpace}, expected nowrap`);
    else pass(`an unpicked row clamps: white-space=${before.whiteSpace}`);
    if (before.overflow !== "hidden" || before.textOverflow !== "ellipsis") fail(`an unpicked row must truncate: overflow=${before.overflow} text-overflow=${before.textOverflow}`);
    else pass("an unpicked row truncates with an ellipsis");
    if (!before.clipped) fail(`the ${target.label} reason fits one line at this width, so the clamp is not observable; widen the text or narrow the viewport`);
    else pass(`the unpicked reason overflows one line: scrollWidth ${before.scrollWidth} > clientWidth ${before.clientWidth}`);

    const shotBefore = await browser.page.screenshot("picker-wrap-01-unpicked");
    console.log(`screenshot: ${shotBefore}`);

    const clicked = await browser.page.clickReal(ROW(target.label));
    if (!clicked) fail(`the ${target.label} row was not clickable`);
    else pass(`picked the ${target.label} row`);
    await delay(500);

    const after = await browser.page.eval(reasonProbe(target.label));
    info(`picked "${target.label}": ${JSON.stringify(after)}`);
    if (after === null) throw new Error("the reason span vanished after picking");
    if (!after.selected) fail("the row did not register as picked");
    else pass("the row registers as picked (aria-pressed=true)");
    if (after.whiteSpace !== "normal") fail(`a picked row must wrap: white-space=${after.whiteSpace}, expected normal`);
    else pass(`a picked row wraps: white-space=${after.whiteSpace}`);
    if (after.clipped) fail(`the picked reason is still clipped: scrollWidth ${after.scrollWidth} > clientWidth ${after.clientWidth}`);
    else pass(`the picked reason is not clipped: scrollWidth ${after.scrollWidth} <= clientWidth ${after.clientWidth}`);
    if (after.height > before.height) pass(`the picked row grew ${before.height}px -> ${after.height}px to fit the wrapped reason`);
    else fail(`the picked row did not grow: ${before.height}px -> ${after.height}px, so it may still clamp`);

    const shotAfter = await browser.page.screenshot("picker-wrap-02-picked");
    console.log(`screenshot: ${shotAfter}`);

    console.log(`\nRESULT: ${target.label} whiteSpace ${before.whiteSpace} -> ${after.whiteSpace}, height ${before.height} -> ${after.height}`);
  } finally {
    browser.close();
    if (server) { server.kill("SIGTERM"); await delay(1500); if (!server.killed) server.kill("SIGKILL"); }
  }
};

try { await main(); } catch (error) { fail(error.stack ?? error.message); }
if (failures.length > 0) { console.error(`\n${failures.length} check(s) failed`); if (!KEEP) process.exitCode = 1; }
else console.log("\nall picker-wrap proof checks passed");
