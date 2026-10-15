// Independent proof for citadels room creation (this session's verification).
// Usage: node scripts/proof-citadels-room.mjs [--port 3287]
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1]; };
const PORT = Number(argOf("--port", "3287"));
const BASE = `http://localhost:${PORT}`;
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = new URL("../.audit/proof/", import.meta.url).pathname;
const STAMP = Date.now();
const PASSWORD = "proof-password-123";

const failures = [];
const fail = (msg) => { failures.push(msg); console.error(`FAIL: ${msg}`); };
const pass = (msg) => console.log(`PASS: ${msg}`);
mkdirSync(OUT, { recursive: true });

const serverAnswers = async () => { try { const r = await fetch(`${BASE}/api/auth/ok`); return r.ok; } catch { return false; } };
const startServer = async () => {
  if (await serverAnswers()) return { server: null, reused: true };
  const server = spawn("pnpm", ["exec", "nuxt", "dev", "--port", String(PORT), "--host", "localhost"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" } });
  let log = ""; server.stdout.on("data", (d) => (log += d)); server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 240; i++) { if (await serverAnswers()) return { server, reused: false }; await delay(1000); }
  throw new Error(`dev server never ready:\n${log}`);
};

const signUp = async (label) => {
  const email = `${label}-${STAMP}@example.com`;
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ email, password: PASSWORD, name: label }) });
  if (res.status !== 200) throw new Error(`sign-up ${label} returned ${res.status}: ${await res.text()}`);
  const cookie = res.headers.get("set-cookie"); if (!cookie) throw new Error("no cookie");
  const [pair] = cookie.split(";"); const eq = pair.indexOf("=");
  return { cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1), email };
};

const launchBrowser = async (label, debugPort) => {
  const profileDir = `/tmp/proof-citadels-${label}-${PORT}-${process.pid}`;
  rmSync(profileDir, { recursive: true, force: true });
  const chrome = spawn("/usr/bin/google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", `--user-data-dir=${profileDir}`, `--remote-debugging-port=${debugPort}`, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 80; i++) { try { const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`); if (res.ok) { wsUrl = (await res.json()).webSocketDebuggerUrl; break; } } catch {} await delay(250); }
  if (!wsUrl) throw new Error(`${label}: chrome never exposed a debug endpoint`);
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const listeners = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method && listeners.has(m.method)) for (const fn of listeners.get(m.method)) fn(m.params); };
  const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const on = (method, fn) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(fn); };
  const { result: created } = await send("Target.createTarget", { url: "about:blank" });
  const { result: attached } = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const session = attached.sessionId;
  await send("Page.enable", {}, session); await send("Runtime.enable", {}, session); await send("Network.enable", {}, session);
  const page = {
    async setViewport(w, h) { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false }, session); await delay(300); },
    async setSessionCookie(u) { await send("Network.setCookie", { url: BASE, name: u.cookieName, value: u.cookieValue }, session); },
    async goto(url, { waitMs = 1500 } = {}) { const loaded = new Promise((res) => { on("Page.loadEventFired", () => res()); setTimeout(res, 15000); }); await send("Page.navigate", { url }, session); await loaded; await delay(waitMs); },
    async eval(expression) { const msg = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, session); if (msg.error) throw new Error(`eval error: ${JSON.stringify(msg.error)}`); if (msg.result.exceptionDetails) throw new Error(`eval failed: ${msg.result.exceptionDetails.text}`); return msg.result.result.value; },
    async waitFor(expression, { timeoutMs = 10000 } = {}) { const deadline = Date.now() + timeoutMs; while (Date.now() < deadline) { if (await page.eval(`!!(${expression})`)) return true; await delay(200); } return false; },
    async waitForHydration({ timeoutMs = 30000 } = {}) { const ok = await page.waitFor("document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__", { timeoutMs }); if (!ok) throw new Error("Vue never hydrated"); return true; },
    async rectOf(jsEl) { return page.eval(`(() => { const el = ${jsEl}; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`); },
    async mouseClick(x, y) { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 }, session); await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 }, session); await delay(80); await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 }, session); },
    async clickElement(jsEl, effect, { attempts = 8 } = {}) { for (let i = 0; i < attempts; i++) { if (await page.eval(`!!(${effect})`)) return true; const first = await page.rectOf(jsEl); if (first === null) { await delay(250); continue; } await delay(200); const again = await page.rectOf(jsEl); if (again === null || Math.abs(first.x - again.x) >= 2 || Math.abs(first.y - again.y) >= 2) continue; await page.mouseClick(again.x, again.y); for (let wait = 0; wait < 6; wait++) { if (await page.eval(`!!(${effect})`)) return true; await delay(200); } } return false; },
    async screenshot(name) { const { result } = await send("Page.captureScreenshot", { format: "png" }, session); const path = `${OUT}${name}.png`; writeFileSync(path, Buffer.from(result.data, "base64")); return path; },
  };
  return { chrome, page, close: () => chrome.kill("SIGKILL") };
};

const ROOM_PATH = "location.pathname.match(/^\\/rooms\\/[A-Z]{8,9}$/) !== null";
const SUBMIT = "button[type=submit]";
const DIALOG = "[role=alertdialog]";
const DIALOG_CREATE = `(() => [...document.querySelectorAll('[role=alertdialog] button')].find((b) => b.textContent.trim() === "Create room") ?? null)()`;
const GAME_OPTION = (label) => `[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === ${JSON.stringify(label)})`;
const SETUP_OPTION = (id) => `document.querySelector('[data-setup-option][data-character="' + ${JSON.stringify(id)} + '"]')`;

const createCitadels = async (page) => {
  await page.goto(`${BASE}/rooms/new`);
  if (!(await page.waitFor("location.pathname === '/rooms/new'", { timeoutMs: 15000 }))) throw new Error("not on create form");
  await page.waitForHydration();
  if (!(await page.waitFor("document.querySelector('#game')"))) throw new Error("no game select");
  const label = await page.eval("document.querySelector('#setup-label')?.textContent.trim()");
  if (label !== "Roles") fail(`default setup label is ${label}, expected Roles`);
  else pass("g54 is the default game (setup label 'Roles')");

  const opened = await page.clickElement("document.querySelector('#game')", "document.querySelectorAll('[role=option]').length >= 2");
  if (!opened) throw new Error("game select never opened");
  const chose = await page.clickElement(GAME_OPTION("Citadels"), "document.querySelector('#setup-label')?.textContent.trim() === 'Cast'");
  if (!chose) throw new Error("could not select Citadels");
  pass("switched the game to Citadels (setup label 'Cast')");

  const seats = await page.eval("[...document.querySelectorAll('#seats')].length && (() => { const t = document.querySelector('#seats'); return t ? t.textContent.trim() : null; })()");
  if (seats !== "5") fail(`seats after switch is ${seats}, expected the clamped 5`);
  else pass("seats clamped to 5 on switch");

  await page.eval(`(() => { const input = document.querySelector('#room-name'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, "Citadels proof"); input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  await page.eval(`(() => { const t = document.querySelector('#seats'); t.click(); return true; })()`);
  await page.waitFor("document.querySelectorAll('[role=option]').length >= 2");
  await page.clickElement(`[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === '3')`, "document.querySelector('#seats')?.textContent.includes('3')");
  await delay(400);

  const cards = await page.eval("document.querySelectorAll('[data-setup-option]').length");
  if (cards !== 27) fail(`${cards} character cards, expected 27`);
  else pass("27 character cards across ranks 1-9");

  const preset = await page.eval("document.querySelectorAll('[data-setup-option][aria-pressed=true]').length");
  if (preset !== 8) fail(`${preset} preset picks, expected 8 (BASE_CAST)`);
  else pass("BASE_CAST pre-selected (8 of 8)");

  const submitEnabled = await page.eval(`!document.querySelector(${JSON.stringify(SUBMIT)}).disabled`);
  if (!submitEnabled) fail("Create room disabled with a complete default cast");
  else pass("Create room enabled with the default cast");

  // Add the optional rank 9, then clear one required rank and re-check.
  await page.eval(`(() => { const card = [...document.querySelectorAll('[data-setup-option]')].find((c) => c.getAttribute('aria-label')?.startsWith('Rank 9')); card.click(); return true; })()`);
  await delay(300);
  const ninth = await page.eval("document.querySelectorAll('[data-setup-option][aria-pressed=true]').length");
  if (ninth !== 9) fail(`${ninth} picks after adding rank 9, expected 9`);
  else pass("rank 9 pick yields a 9-character cast");

  await page.eval(`(() => { const card = [...document.querySelectorAll('[data-setup-option]')].find((c) => c.getAttribute('aria-label')?.startsWith('Rank 1')); card.click(); return true; })()`);
  await delay(300);
  const clearedEnabled = await page.eval(`!document.querySelector(${JSON.stringify(SUBMIT)}).disabled`);
  const missingText = await page.eval("document.body.innerText.includes('Still to choose')");
  if (clearedEnabled) fail("Create room stayed enabled after clearing rank 1");
  else pass("Create room disabled once a required rank is cleared");
  if (!missingText) fail("no 'Still to choose' hint after clearing a rank");
  else pass("'Still to choose' hint names the missing rank");
  await page.screenshot("citadels-create-form");

  await page.eval(`(() => { const card = [...document.querySelectorAll('[data-setup-option]')].find((c) => c.getAttribute('aria-label')?.startsWith('Rank 1')); card.click(); return true; })()`);
  await delay(300);

  const openedDialog = await page.clickElement(`document.querySelector(${JSON.stringify(SUBMIT)})`, `!!document.querySelector(${JSON.stringify(DIALOG)})`);
  if (!openedDialog) throw new Error("confirm dialog never opened");
  const dialogLabel = await page.eval(`(() => { const dt = [...document.querySelectorAll('[role=alertdialog] dt')].find((d) => d.textContent.trim() === 'Cast'); return !!dt; })()`);
  if (!dialogLabel) fail("confirm dialog does not label the setup 'Cast'");
  else pass("confirm dialog renders the cast");
  await page.screenshot("citadels-confirm");

  let created = null;
  const navigated = page.waitFor(ROOM_PATH, { timeoutMs: 20000 });
  await page.clickElement(DIALOG_CREATE, ROOM_PATH);
  if (!(await navigated)) {
    const err = await page.eval("document.querySelector('[role=alertdialog] p[role=alert]')?.textContent ?? 'no error text'");
    throw new Error("did not reach the lobby after create: " + err);
  }
  created = await page.eval("location.pathname");
  pass(`created a citadels room at ${created}`);
  await page.waitFor("document.body.innerText.includes('Cast')", { timeoutMs: 15000 });
  const lobbyCast = await page.eval("document.querySelectorAll('[data-slot=character-card]').length");
  if (lobbyCast < 8) fail(`lobby rendered ${lobbyCast} character cards, expected >= 8`);
  else pass(`lobby renders the cast (${lobbyCast} cards)`);
  await page.screenshot("citadels-lobby");
  return created;
};

const createG54 = async (page) => {
  await page.goto(`${BASE}/rooms/new`);
  await page.waitForHydration();
  await page.eval(`(() => { const input = document.querySelector('#room-name'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, "G54 proof"); input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
  const rolesReady = await page.waitFor("document.querySelectorAll('[data-role-option]').length === 31");
  if (!rolesReady) fail("g54 role picker did not render 31 roles");
  else pass("g54 create form still renders the role picker");
  const preset = await page.eval("document.querySelectorAll('[data-role-option][aria-pressed=true]').length");
  if (preset !== 5) fail(`${preset} preset roles, expected 5`);
  else pass("g54 default role draft is complete");
  await page.clickElement(`document.querySelector(${JSON.stringify(SUBMIT)})`, `!!document.querySelector(${JSON.stringify(DIALOG)})`);
  const navigated = page.waitFor(ROOM_PATH, { timeoutMs: 20000 });
  await page.clickElement(DIALOG_CREATE, ROOM_PATH);
  if (!(await navigated)) {
    const err = await page.eval("document.querySelector('[role=alertdialog] p[role=alert]')?.textContent ?? 'no error text'");
    throw new Error("g54 create did not reach the lobby: " + err);
  }
  await page.waitFor("document.body.innerText.includes('Roles')", { timeoutMs: 15000 });
  const lobbyRoles = await page.eval("document.querySelectorAll('[data-slot=role-card]').length");
  if (lobbyRoles < 5) fail(`g54 lobby rendered ${lobbyRoles} role cards, expected >= 5`);
  else pass(`g54 lobby unchanged (${lobbyRoles} role cards)`);
  return page.eval("location.pathname");
};

const main = async () => {
  const { server, reused } = await startServer();
  if (reused) console.warn("note: reusing a running dev server");
  let browser = null;
  try {
    const user = await signUp("citadels-proof");
    pass("created the proof account");
    browser = await launchBrowser("main", PORT + 71);
    await browser.page.setViewport(1280, 1000);
    await browser.page.setSessionCookie(user);
    const citadelsRoom = await createCitadels(browser.page);
    const g54Room = await createG54(browser.page);
    if (citadelsRoom === g54Room) fail("both games resolved to the same room path");
    else pass(`distinct rooms: ${citadelsRoom} and ${g54Room}`);
    console.log(failures.length === 0 ? "\nALL PASS" : `\n${failures.length} FAILURE(S)`);
  } finally {
    browser?.close();
    server?.kill("SIGKILL");
  }
  process.exit(failures.length === 0 ? 0 : 1);
};
main().catch((e) => { console.error("PROOF ERROR:", e); process.exit(2); });
