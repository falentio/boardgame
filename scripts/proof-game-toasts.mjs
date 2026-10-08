// Live proof of the game-event toasts: an actor-audience coin change reaches only
// the seat whose ledger moved, and a room-audience card loss reaches every seat.
//
// Two seats play a 2-player game. The host takes Income and only the host's
// browser shows the success toast. The guest takes Income and only the guest's
// browser shows it. The host then claims a role, the guest challenges, the host
// concedes, and the reveal lands a warning toast on both browsers.
//
// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth
// rejects the sign-up with INVALID_ORIGIN.
//
// Usage: node scripts/proof-game-toasts.mjs [--port 3000] [--out DIR] [--keep]
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

// All worktrees share one node_modules/.vite dep cache, so two dev servers
// writing it corrupt the cache and the page stops hydrating. Reuse a server
// that already answers and only spawn one when nothing is listening.
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
  const email = `toast-${label}-${STAMP}@example.com`;
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
  const profileDir = `/tmp/proof-toast-${label}-${PORT}-${process.pid}`;
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
    // A real CDP pointer sequence at the element's centre, because reka-ui's
    // controls ignore a synthetic `el.click()`.
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

const EL = {
  picker: "[data-slot=window-picker]",
  roleCard: (name) => `[...document.querySelectorAll('[data-slot=window-picker] button[data-slot=role-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  generalCard: (name) => `[...document.querySelectorAll('[data-slot=window-picker] button[data-slot=general-action-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  confirm: `[...document.querySelectorAll('[data-slot=window-picker] button')].find((b) => b.textContent.trim() === 'Confirm')`,
  buttonText: (name) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(name)}))`,
  // One toast node per sonner toast; data-type carries the severity variant.
  toasts: "document.querySelectorAll('[data-sonner-toast]').length",
  toastTitles: `Array.from(document.querySelectorAll('[data-sonner-toast] [data-title]')).map((el) => el.textContent.trim())`,
  toastTypes: `Array.from(document.querySelectorAll('[data-sonner-toast]')).map((el) => el.getAttribute('data-type'))`,
};

const toastTitles = (page) => page.eval(EL.toastTitles);
const toastTypes = (page) => page.eval(EL.toastTypes);
// Toaster has no close button, so a toast clears only by its 4 s auto-dismiss.
// Wait for the queue to drain before the next scenario asserts on it.
const clearToasts = async (page) => {
  const drained = await page.waitFor(`(${EL.toasts}) === 0`, { timeoutMs: 8000 });
  if (!drained) console.warn("note: toasts did not drain before the next scenario");
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
    await hostBrowser.page.setViewport(1280, 1000);
    await guestBrowser.page.setViewport(1280, 1000);
    await hostBrowser.page.setSessionCookie(host);
    await guestBrowser.page.setSessionCookie(guest);

    await hostBrowser.page.goto(`${BASE}/rooms/new`);
    await hostBrowser.page.waitForHydration();
    const pickerReady = await hostBrowser.page.waitFor("document.querySelectorAll('[data-role-option]').length === 31", { timeoutMs: 15000 });
    if (!pickerReady) throw new Error("the create page never rendered the 31-role picker");
    pass("create page hydrated with the 31-role picker");

    let opened = false;
    for (let attempt = 0; attempt < 5 && !opened; attempt++) {
      await hostBrowser.page.clickReal("document.querySelector('#seats')");
      opened = await hostBrowser.page.waitFor("document.querySelectorAll('[role=option]').length >= 7", { timeoutMs: 2000 });
    }
    if (!opened) throw new Error("the seats select did not open");
    await hostBrowser.page.clickReal(`[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === '2')`);
    await hostBrowser.page.clickReal(EL.buttonText("Create room"));
    const inLobby = await hostBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8}$/.test(location.pathname)", { timeoutMs: 20000 });
    if (!inLobby) throw new Error(`create did not land in the lobby, at ${await hostBrowser.page.url()}`);
    const code = (await hostBrowser.page.url()).replace("/rooms/", "");
    pass(`host created room ${code}`);

    await guestBrowser.page.goto(`${BASE}/join/${code}`);
    let guestInLobby = await guestBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8}$/.test(location.pathname)", { timeoutMs: 20000 });
    if (!guestInLobby) {
      await guestBrowser.page.goto(`${BASE}/rooms/${code}`);
      guestInLobby = await guestBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8}$/.test(location.pathname)", { timeoutMs: 20000 });
    }
    if (!guestInLobby) throw new Error(`guest link did not land in the lobby, at ${await guestBrowser.page.url()}`);
    pass("guest joined through the shared link");

    let full = await hostBrowser.page.waitFor("document.body.innerText.includes('All seats filled')", { timeoutMs: 15000 });
    if (!full) {
      await hostBrowser.page.goto(`${BASE}/rooms/${code}`);
      full = await hostBrowser.page.waitFor("document.body.innerText.includes('All seats filled')", { timeoutMs: 15000 });
    }
    if (!full) throw new Error(`room ${code} never became full for the host`);
    await hostBrowser.page.clickReal(EL.buttonText("Start game"));
    const onGame = await hostBrowser.page.waitFor("/^\\/games\\/[A-Z]{8}$/.test(location.pathname)", { timeoutMs: 15000 });
    if (!onGame) throw new Error(`Start game did not open the board, at ${await hostBrowser.page.url()}`);
    pass("host's Start game opened the board");

    await guestBrowser.page.goto(`${BASE}/games/${code}`);
    await hostBrowser.page.waitForHydration();
    await guestBrowser.page.waitForHydration();
    const hostBoard = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    const guestBoard = await guestBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    if (!hostBoard || !guestBoard) throw new Error(`board missing (host ${hostBoard}, guest ${guestBoard})`);
    pass("both seats rendered the game board");

    const hostTurn = await hostBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 20000 });
    if (!hostTurn) throw new Error(`host never got the turn window; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    await clearToasts(hostBrowser.page);
    await clearToasts(guestBrowser.page);
    const clickedIncome = await hostBrowser.page.clickReal(EL.generalCard("Income"));
    if (!clickedIncome) throw new Error("host could not select Income");
    await hostBrowser.page.clickReal(EL.confirm);

    const hostSawCoin = await hostBrowser.page.waitFor(`(${EL.toastTitles}).some((t) => t.includes('gained'))`, { timeoutMs: 10000 });
    const hostCoinTitles = await toastTitles(hostBrowser.page);
    const hostCoinTypes = await toastTypes(hostBrowser.page);
    if (!hostSawCoin) fail(`host did not see a coin-gain toast; titles: ${JSON.stringify(hostCoinTitles)}`);
    else if (!hostCoinTitles.some((t) => t.includes("You gained"))) fail(`host coin toast did not read "You gained...": ${JSON.stringify(hostCoinTitles)}`);
    else pass(`host saw the actor coin toast: ${JSON.stringify(hostCoinTitles)}`);
    if (!hostCoinTypes.includes("success")) fail(`host coin toast was not a success variant: ${JSON.stringify(hostCoinTypes)}`);
    else pass("host coin toast rendered as the success variant");

    const guestCoinTitles = await toastTitles(guestBrowser.page);
    if (guestCoinTitles.length !== 0) fail(`guest saw the host's private coin toast: ${JSON.stringify(guestCoinTitles)}`);
    else pass("guest saw no toast for the host's coin gain");
    console.log(`screenshot: ${await hostBrowser.page.screenshot("toast-01-host-income")}`);

    await clearToasts(hostBrowser.page);
    const guestTurn = await guestBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 15000 });
    if (!guestTurn) throw new Error(`guest never got the turn window; body: ${(await guestBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    await guestBrowser.page.clickReal(EL.generalCard("Income"));
    await guestBrowser.page.clickReal(EL.confirm);

    const guestSawCoin = await guestBrowser.page.waitFor(`(${EL.toastTitles}).some((t) => t.includes('You gained'))`, { timeoutMs: 10000 });
    const guestCoinTitles2 = await toastTitles(guestBrowser.page);
    if (!guestSawCoin) fail(`guest did not see its own coin-gain toast; titles: ${JSON.stringify(guestCoinTitles2)}`);
    else pass(`guest saw its own actor coin toast: ${JSON.stringify(guestCoinTitles2)}`);
    const hostCoinTitles2 = await toastTitles(hostBrowser.page);
    if (hostCoinTitles2.length !== 0) fail(`host saw the guest's private coin toast: ${JSON.stringify(hostCoinTitles2)}`);
    else pass("host saw no toast for the guest's coin gain");

    const hostAgain = await hostBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 15000 });
    if (!hostAgain) throw new Error("host never regained the turn window");
    await clearToasts(hostBrowser.page);
    await clearToasts(guestBrowser.page);
    const claimed = await hostBrowser.page.clickReal(EL.roleCard("Banker"));
    if (!claimed) fail("host could not select the Banker card");
    else pass("host selected the Banker claim");
    await hostBrowser.page.clickReal(EL.confirm);

    const guestChallenge = await guestBrowser.page.waitFor(`!!${EL.generalCard("Challenge")}`, { timeoutMs: 15000 });
    if (!guestChallenge) fail(`guest never saw the challenge window; body: ${(await guestBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    else pass("guest saw the challenge window");
    await guestBrowser.page.clickReal(EL.generalCard("Challenge"));
    await guestBrowser.page.clickReal(EL.confirm);

    const hostProof = await hostBrowser.page.waitFor(`!!${EL.generalCard("Concede")}`, { timeoutMs: 15000 });
    if (!hostProof) fail(`host never saw the proof window; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    else pass("host saw the proof window");
    await hostBrowser.page.clickReal(EL.generalCard("Concede"));
    await hostBrowser.page.clickReal(EL.confirm);

    const revealReady = await hostBrowser.page.waitFor(
      `document.querySelectorAll('[data-slot=window-picker] button[data-slot=role-card]').length > 0`,
      { timeoutMs: 12000 },
    );
    if (!revealReady) fail("host never saw the reveal picker after conceding");
    else pass("host saw the reveal picker");
    await hostBrowser.page.clickReal(`document.querySelector('[data-slot=window-picker] button[data-slot=role-card]')`);
    await hostBrowser.page.clickReal(EL.confirm);

    const hostSawLoss = await hostBrowser.page.waitFor(`(${EL.toastTitles}).some((t) => t.includes('lost a card'))`, { timeoutMs: 12000 });
    const guestSawLoss = await guestBrowser.page.waitFor(`(${EL.toastTitles}).some((t) => t.includes('lost a card'))`, { timeoutMs: 12000 });
    const hostLossTitles = await toastTitles(hostBrowser.page);
    const guestLossTitles = await toastTitles(guestBrowser.page);
    const hostLossTypes = await toastTypes(hostBrowser.page);
    if (!hostSawLoss) fail(`host did not see the room card-loss toast; titles: ${JSON.stringify(hostLossTitles)}`);
    else pass(`host saw the room card-loss toast: ${JSON.stringify(hostLossTitles)}`);
    if (!guestSawLoss) fail(`guest did not see the room card-loss toast; titles: ${JSON.stringify(guestLossTitles)}`);
    else pass(`guest saw the room card-loss toast: ${JSON.stringify(guestLossTitles)}`);
    if (!hostLossTypes.includes("warning")) fail(`the card-loss toast was not a warning variant: ${JSON.stringify(hostLossTypes)}`);
    else pass("the card-loss toast rendered as the warning variant");
    console.log(`screenshot: ${await hostBrowser.page.screenshot("toast-02-host-card-loss")}`);
    console.log(`screenshot: ${await guestBrowser.page.screenshot("toast-03-guest-card-loss")}`);
  } finally {
    hostBrowser.close();
    guestBrowser.close();
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
  console.log("\nall game-toast proof checks passed");
}
