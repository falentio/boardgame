// Proves on the real board that the Spy second action cannot be Spy again.
//
// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth
// rejects the sign-up with INVALID_ORIGIN.
//
// Usage: node scripts/proof-spy-once-per-turn.mjs [--port 3000] [--keep]
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
const OUT = new URL("../.audit/proof/", import.meta.url).pathname;
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
  try { return (await fetch(`${BASE}/api/auth/ok`)).ok; } catch { return false; }
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
  const email = `spy-once-${label}-${STAMP}@example.com`;
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
  const profileDir = `/tmp/proof-spy-once-${label}-${PORT}-${process.pid}`;
  rmSync(profileDir, { recursive: true, force: true });
  const chrome = spawn(
    "/usr/bin/google-chrome",
    ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
      `--user-data-dir=${profileDir}`, `--remote-debugging-port=${debugPort}`,
      "--remote-allow-origins=*", "about:blank"],
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
  pickerRoleCard: (name) => `[...document.querySelectorAll('[data-slot=window-picker] button[data-slot=role-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  pickerGeneralCard: (name) => `[...document.querySelectorAll('[data-slot=window-picker] button[data-slot=general-action-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  pickerRoleNames: `[...document.querySelectorAll('[data-slot=window-picker] button[data-slot=role-card]')].map((b) => (b.getAttribute('aria-label') || '').split(',')[0])`,
  pickerRoleState: (name) => `(() => {
    const b = [...document.querySelectorAll('[data-slot=window-picker] button[data-slot=role-card]')].find((x) => (x.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}));
    if (!b) return null;
    return { disabled: b.disabled, reason: (b.parentElement?.querySelector(':scope > span')?.textContent ?? '').trim(), opacity: getComputedStyle(b).opacity };
  })()`,
  createRoleCard: (name) => `[...document.querySelectorAll('[data-role-option][aria-label]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  confirm: `[...document.querySelectorAll('[data-slot=window-picker] button')].find((b) => b.textContent.trim() === 'Confirm')`,
  buttonText: (name) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(name)}))`,
  pickerTitle: `document.querySelector('[data-slot=window-picker] h2')?.textContent.trim() ?? null`,
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

    // The page re-renders while the session fetch settles, so a rect measured
    // before the click can go stale. Click, then verify the pick stuck.
    const spyPressed = async () => hostBrowser.page.eval(`document.querySelector('[data-role-option][aria-label^="Spy"]')?.getAttribute('aria-pressed') === 'true'`);
    let spyPicked = false;
    for (let attempt = 0; attempt < 6 && !spyPicked; attempt++) {
      await hostBrowser.page.clickReal(EL.createRoleCard("Spy"));
      spyPicked = await spyPressed();
    }
    if (!spyPicked) throw new Error(`the Spy card did not register as picked; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    pass("picked Spy into the Finance slot");

    await hostBrowser.page.clickReal("document.querySelector('#seats')");
    await hostBrowser.page.waitFor("document.querySelectorAll('[role=option]').length >= 7", { timeoutMs: 4000 });
    await hostBrowser.page.clickReal(`[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === '2')`);
    pass("set the room to 2 seats");

    await hostBrowser.page.clickReal(EL.buttonText("Create room"));
    const inLobby = await hostBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8}$/.test(location.pathname)", { timeoutMs: 20000 });
    if (!inLobby) throw new Error(`create did not land in the lobby, at ${await hostBrowser.page.url()}`);
    const code = (await hostBrowser.page.url()).replace("/rooms/", "");
    pass(`host created room ${code}`);

    await guestBrowser.page.goto(`${BASE}/join/${code}`);
    const guestInLobby = await guestBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8}$/.test(location.pathname)", { timeoutMs: 20000 });
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
    if (!hostTurn) throw new Error(`host turn window shows no picker; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    pass("host is active and shows the turn picker");

    const clickedSpy = await hostBrowser.page.clickReal(EL.pickerRoleCard("Spy"));
    if (!clickedSpy) throw new Error(`host could not select the Spy card; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    pass("host selected the Spy card for the turn");
    console.log(`screenshot: ${await hostBrowser.page.screenshot("spy-01-claim")}`);

    const confirmed = await hostBrowser.page.clickReal(EL.confirm);
    if (!confirmed) throw new Error("host could not click Confirm");

    const guestChallenge = await guestBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 15000 });
    if (!guestChallenge) throw new Error(`guest never saw the challenge window; body: ${(await guestBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    pass("guest sees the challenge window for the Spy claim");
    const guestPickedPass = await guestBrowser.page.clickReal(EL.pickerGeneralCard("Pass"));
    if (!guestPickedPass) throw new Error(`guest could not select Pass; body: ${(await guestBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    const guestConfirmed = await guestBrowser.page.clickReal(EL.confirm);
    if (!guestConfirmed) throw new Error("guest could not confirm Pass");
    pass("guest passed the challenge");

    const secondAction = await hostBrowser.page.waitFor(`document.querySelector('[data-slot=window-picker] h2')?.textContent.trim() === 'Second action'`, { timeoutMs: 20000 });
    if (!secondAction) throw new Error(`the second-action window never opened; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    pass("the second-action window opened for the host");

    const title = await hostBrowser.page.eval(EL.pickerTitle);
    const roleNames = await hostBrowser.page.eval(EL.pickerRoleNames);
    info(`second-action picker title=${JSON.stringify(title)} role-cards=${JSON.stringify(roleNames)}`);

    // Spy stays in the list, muted with a reason, the same way Guerrilla shows
    // "Needs 4 coins". A dropped card would read as missing, not unavailable.
    const spyState = await hostBrowser.page.eval(EL.pickerRoleState("Spy"));
    info(`Spy card state=${JSON.stringify(spyState)}`);
    if (spyState === null) fail(`the second-action picker dropped the Spy card entirely; role-cards=${JSON.stringify(roleNames)}`);
    else if (!spyState.disabled) fail(`the Spy card is still selectable: ${JSON.stringify(spyState)}`);
    else pass("the second-action picker keeps the Spy card, muted");

    const guerrilla = await hostBrowser.page.eval(EL.pickerRoleState("Guerrilla"));
    info(`Guerrilla card state (the reference mute)=${JSON.stringify(guerrilla)}`);
    if (spyState !== null && guerrilla !== null && spyState.reason === "") fail("the Spy card carries no reason, unlike a priced role");
    else if (spyState !== null) pass(`the Spy card carries a reason: ${JSON.stringify(spyState.reason)}`);
    if (spyState !== null && guerrilla !== null && spyState.opacity !== guerrilla.opacity) fail(`Spy opacity ${spyState.opacity} differs from Guerrilla ${guerrilla.opacity}`);
    else if (spyState !== null) pass(`the Spy card is muted like a priced role (opacity ${spyState.opacity})`);

    const shot = await hostBrowser.page.screenshot("spy-02-second-action");
    console.log(`screenshot: ${shot}`);
    console.log(`\nRESULT: title=${JSON.stringify(title)} roles=${JSON.stringify(roleNames)} spyState=${JSON.stringify(spyState)} guerrilla=${JSON.stringify(guerrilla)}`);
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
  console.log("\nall Spy once-per-turn proof checks passed");
}
