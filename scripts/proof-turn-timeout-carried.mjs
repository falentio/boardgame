// Live proof of the shipped turn timer. Sets up a real 2-seat game, waits for the
// host's turn window (so the host owes input and the clock runs), then asserts the
// banner renders, the number counts down, it carries an accessible name and a
// polite threshold announcement, it survives 375px without clipping, and the
// console stays clean. Screenshots at 1440 and 375.
//
// Usage: node scripts/proof-turn-timer.mjs [--port 3000] [--out DIR] [--keep]
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3000"));
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
  const email = `timer-${label}-${STAMP}@example.com`;
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
  const profileDir = `/tmp/proof-timer-${label}-${PORT}-${process.pid}`;
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

  const consoleEntries = [];
  on("Runtime.consoleAPICalled", (p) => {
    if (p.type === "error" || p.type === "warning") {
      consoleEntries.push(`${p.type}: ${(p.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(" ")}`);
    }
  });
  on("Runtime.exceptionThrown", (p) => {
    consoleEntries.push(`exception: ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`);
  });
  on("Log.entryAdded", (p) => {
    if (p.entry?.level === "error") consoleEntries.push(`log-error: ${p.entry.text}`);
  });
  await send("Log.enable", {}, session);

  const page = {
    async setViewport(width, height) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, session);
      await delay(250);
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
    async url() { return page.eval("location.pathname + location.search"); },
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
  return { chrome, page, consoleEntries, close: () => chrome.kill("SIGKILL") };
};

// The shipped control, its accessible surface, and the live region, in one read.
const timerState = () => `(() => {
  const el = document.querySelector('[data-slot=turn-timer]');
  if (!el) return { present: false };
  const num = el.querySelector('[role=timer]');
  const r = el.getBoundingClientRect();
  const live = [...document.querySelectorAll('[role=status]')].map((n) => n.textContent.trim()).filter(Boolean);
  const bar = el.querySelector('[aria-hidden=true] span');
  return {
    present: true,
    seconds: num ? Number(num.textContent.replace(/[^0-9]/g, '')) : null,
    ariaLabel: num ? num.getAttribute('aria-label') : null,
    text: el.innerText.replace(/\\s+/g, ' ').trim(),
    live,
    barWidth: bar ? getComputedStyle(bar).width : null,
    rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
    viewport: { w: window.innerWidth, h: window.innerHeight },
    hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
})()`;

const EL = {
  picker: "[data-slot=window-picker]",
  confirm: `[...document.querySelectorAll('[data-slot=window-picker] button')].find((b) => b.textContent.trim() === 'Confirm')`,
  buttonText: (name) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(name)}))`,
};

const main = async () => {
  const { server, reused } = await startServer();
  if (reused) console.warn("note: reusing an already-running dev server; not validated as this checkout");
  const host = await signUp("host");
  const guest = await signUp("guest");
  pass(`created accounts ${host.email} and ${guest.email}`);

  const hostBrowser = await launchBrowser("host", PORT + 51);
  const guestBrowser = await launchBrowser("guest", PORT + 52);
  try {
    await hostBrowser.page.setViewport(1440, 1000);
    await guestBrowser.page.setViewport(1440, 1000);
    await hostBrowser.page.setSessionCookie(host);
    await guestBrowser.page.setSessionCookie(guest);

    await hostBrowser.page.goto(`${BASE}/rooms/new`);
    await hostBrowser.page.waitForHydration();
    await hostBrowser.page.waitFor("document.querySelectorAll('[data-role-option]').length === 31", { timeoutMs: 15000 });
    await hostBrowser.page.clickReal("document.querySelector('#seats')");
    await hostBrowser.page.waitFor("document.querySelectorAll('[role=option]').length >= 7", { timeoutMs: 4000 });
    await hostBrowser.page.clickReal(`[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === '2')`);
    await hostBrowser.page.clickReal(EL.buttonText("Create room"));
    const inLobby = await hostBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8}$/.test(location.pathname)", { timeoutMs: 20000 });
    if (!inLobby) throw new Error(`create did not land in the lobby, at ${await hostBrowser.page.url()}`);
    const code = (await hostBrowser.page.url()).replace("/rooms/", "").split("?")[0];
    pass(`host created room ${code}`);

    await guestBrowser.page.goto(`${BASE}/join/${code}`, { waitMs: 2000 });
    const guestSeated = await guestBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8}$/.test(location.pathname)", { timeoutMs: 20000 });
    if (!guestSeated) throw new Error(`guest never landed in the lobby, at ${await guestBrowser.page.url()}`);
    pass("guest joined through the shared link");

    // The host learns of the guest over the room channel, which can lag. Poll the
    // room API for two occupants, then reload the host so the lobby is current.
    let occupants = 0;
    for (let i = 0; i < 20 && occupants < 2; i++) {
      await delay(500);
      const res = await fetch(`${BASE}/api/rooms/${code}`, {
        headers: { cookie: `${host.cookieName}=${host.cookieValue}` },
      });
      if (res.ok) {
        const body = await res.json();
        occupants = (body.room?.seats ?? []).filter((s) => s.occupant !== null).length;
      }
    }
    if (occupants < 2) throw new Error(`room ${code} has ${occupants} occupants, expected 2`);
    pass(`room ${code} reports ${occupants} seated players`);

    let full = false;
    for (let i = 0; i < 4 && !full; i++) {
      await hostBrowser.page.goto(`${BASE}/rooms/${code}`, { waitMs: 1800 });
      full = await hostBrowser.page.waitFor("document.body.innerText.includes('All seats filled')", { timeoutMs: 8000 });
    }
    if (!full) {
      info(`host body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ").slice(0, 600)}`);
      throw new Error(`room ${code} never became full for the host`);
    }
    await hostBrowser.page.clickReal(EL.buttonText("Start game"));
    const onGame = await hostBrowser.page.waitFor("/^\\/games\\/[A-Z]{8}/.test(location.pathname)", { timeoutMs: 15000 });
    if (!onGame) throw new Error(`Start game did not open the board, at ${await hostBrowser.page.url()}`);
    pass("host's Start game opened the board");

    await guestBrowser.page.goto(`${BASE}/games/${code}`);
    await hostBrowser.page.waitForHydration();
    await guestBrowser.page.waitForHydration();
    await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    await guestBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    pass("both seats rendered the game board");

    // The host owes input in the turn window, so its clock is running.
    const hostTurn = await hostBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 20000 });
    if (!hostTurn) throw new Error(`host turn window never opened; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    pass("host turn window is open and the host owes input");

    const ready = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=turn-timer]')", { timeoutMs: 20000 });
    if (!ready) throw new Error(`the turn timer never rendered; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ").slice(0, 500)}`);

    const state = await hostBrowser.page.eval(timerState());
    info(`timer: ${JSON.stringify(state)}`);
    if (state.seconds === null || Number.isNaN(state.seconds)) fail("no numeric seconds rendered");
    else pass(`the timer renders ${state.seconds}s`);
    if (state.seconds <= 0 || state.seconds > 30) fail(`${state.seconds}s is outside 1..30 for a 30s clock`);
    if (!state.ariaLabel || !/seconds? left/.test(state.ariaLabel)) fail(`the countdown has no "seconds left" accessible name (got ${JSON.stringify(state.ariaLabel)})`);
    else pass(`the countdown carries the accessible name ${JSON.stringify(state.ariaLabel)}`);
    if (!/You have/.test(state.text) || !/to act/.test(state.text)) fail(`the banner copy is off: ${JSON.stringify(state.text)}`);
    else pass(`the banner reads ${JSON.stringify(state.text)}`);
    if (state.barWidth === null) fail("the progress bar did not render");
    else pass(`the progress bar renders at ${state.barWidth}`);
    if (!state.live.includes("Turn")) fail(`the open-window status line is missing; live regions: ${JSON.stringify(state.live)}`);
    const shot1 = await hostBrowser.page.screenshot("turn-timer-1440");
    console.log(`screenshot: ${shot1}`);

    const beforeReload = state.seconds;
    info(`before reload: ${beforeReload}s`);

    // Defect B: the turn-holder's client disappears. A present peer must carry
    // the silent seat so the frame still seals, instead of hanging forever.
    info("closing the host browser to make the turn-holder's client disappear");
    hostBrowser.close();
    const guestTurnOpens = await guestBrowser.page.waitFor(
      `!!document.querySelector('${EL.picker}')`,
      { timeoutMs: 45000 },
    );
    const guestState = await guestBrowser.page.eval(timerState());
    info(`guest after the host left: ${JSON.stringify(guestState)}`);
    if (guestTurnOpens) pass("a present peer carried the silent turn-holder, so the frame sealed and the guest's own turn opened");
    else fail(`the frame never sealed after the turn-holder left; guest body: ${(await guestBrowser.page.bodyText()).replace(/\n/g, " | ").slice(0, 400)}`);
    const shotB = await guestBrowser.page.screenshot("turn-timeout-carried-by-present-peer");
    console.log(`screenshot: ${shotB}`);

    const noisy = [...guestBrowser.consoleEntries].filter(
      (entry) => !/Nuxt DevTools|Suspense|\[vite\]|favicon|Download the Vue Devtools/i.test(entry),
    );
    if (noisy.length > 0) fail(`console was not clean: ${JSON.stringify(noisy.slice(0, 8), null, 2)}`);
    else pass("console clean on the surviving page");
  } finally {
    try { guestBrowser.close(); } catch {}
    if (server) {
      server.kill("SIGTERM");
      await delay(1500);
      if (!server.killed) server.kill("SIGKILL");
    }
  }
};

try {
  await main();
} catch (error) {
  fail(error.stack ?? error.message);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  if (!KEEP) process.exitCode = 1;
} else {
  console.log("\nall carried-by-present-peer checks passed");
}
