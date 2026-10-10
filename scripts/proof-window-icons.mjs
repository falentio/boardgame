// Usage: node scripts/proof-window-icons.mjs [--port 3007] [--out DIR] [--keep]
//
// Realtime fan-out needs the local Pusher env (PUSHER_APP_KEY/HOST/SECRET)
// exported for the dev server and its CA trusted by the browser, so the guest
// seat sees the host's turn. BETTER_AUTH_URL in .dev.vars must match --port.
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => { const i = args.indexOf(name); return i === -1 ? fallback : args[i + 1]; };
const PORT = Number(argOf("--port", "3007"));
const KEEP = args.includes("--keep");
const BASE = "http://localhost:" + PORT;
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = argOf("--out", new URL("../.audit/proof/", import.meta.url).pathname);
const STAMP = Date.now();
const PASSWORD = "proof-password-123";

mkdirSync(OUT, { recursive: true });

const failures = [];
const fail = (msg) => { failures.push(msg); console.error("FAIL: " + msg); };
const pass = (msg) => console.log("PASS: " + msg);
const info = (msg) => console.log("INFO: " + msg);

const serverAnswers = async () => {
  try { const res = await fetch(BASE + "/api/auth/ok"); return res.ok; } catch { return false; }
};

const startServer = async () => {
  if (await serverAnswers()) return { server: null, reused: true };
  const server = spawn("pnpm", ["exec", "nuxt", "dev", "--port", String(PORT), "--host", "localhost"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" } });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 180; i++) { if (await serverAnswers()) return { server, reused: false }; await delay(1000); }
  throw new Error("dev server never became ready:\n" + log);
};

const signUp = async (label) => {
  const email = "icons-" + label + "-" + STAMP + "@example.com";
  const res = await fetch(BASE + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name: label }),
  });
  const body = await res.text();
  if (res.status !== 200) throw new Error("sign-up " + label + " returned " + res.status + ": " + body);
  const { user } = JSON.parse(body);
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("sign-up " + label + " set no cookie");
  const [pair] = cookie.split(";");
  const eq = pair.indexOf("=");
  return { id: user.id, email, name: label, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const launchBrowser = async (label, debugPort) => {
  const profileDir = "/tmp/proof-icons-" + label + "-" + PORT + "-" + process.pid;
  rmSync(profileDir, { recursive: true, force: true });
  const chrome = spawn("/usr/bin/google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--ignore-certificate-errors",
    "--user-data-dir=" + profileDir, "--remote-debugging-port=" + debugPort,
    "--remote-allow-origins=*", "about:blank",
  ], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 80; i++) {
    try { const res = await fetch("http://127.0.0.1:" + debugPort + "/json/version"); if (res.ok) { wsUrl = (await res.json()).webSocketDebuggerUrl; break; } } catch {}
    await delay(250);
  }
  if (!wsUrl) throw new Error(label + ": chrome never exposed a debug endpoint");

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
  const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const on = (method, fn) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(fn); };

  const { result: created } = await send("Target.createTarget", { url: "about:blank" });
  const { result: attached } = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const session = attached.sessionId;
  await send("Page.enable", {}, session);
  await send("Runtime.enable", {}, session);
  await send("Network.enable", {}, session);

  const page = {
    async setViewport(width, height) { await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, session); await delay(200); },
    async setSessionCookie(user) { await send("Network.setCookie", { url: BASE, name: user.cookieName, value: user.cookieValue }, session); },
    async goto(url, { waitMs = 1500 } = {}) {
      const loaded = new Promise((res) => { on("Page.loadEventFired", () => res()); setTimeout(res, 15000); });
      await send("Page.navigate", { url }, session);
      await loaded;
      await delay(waitMs);
    },
    async eval(expression) {
      const msg = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, session);
      if (msg.error) throw new Error("eval error: " + JSON.stringify(msg.error));
      if (msg.result.exceptionDetails) throw new Error("eval failed: " + msg.result.exceptionDetails.text);
      return msg.result.result.value;
    },
    async url() { return page.eval("location.pathname"); },
    async bodyText() { return page.eval("document.body.innerText"); },
    async waitFor(expression, { timeoutMs = 8000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) { if (await page.eval("!!(" + expression + ")")) return true; await delay(200); }
      return false;
    },
    async waitForHydration({ timeoutMs = 30000 } = {}) {
      const ok = await page.waitFor("!!(document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__)", { timeoutMs });
      if (!ok) throw new Error("Vue never hydrated");
      return true;
    },
    async rectOf(jsEl) {
      return page.eval("(() => { const el = " + jsEl + "; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, disabled: !!el.disabled }; })()");
    },
    async focus(jsEl) { await page.eval("(() => { const el = " + jsEl + "; if (el) el.focus(); })()"); },
    async key(key, code, keyCode) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, session);
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, session);
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
      const path = OUT + name + ".png";
      writeFileSync(path, Buffer.from(result.data, "base64"));
      return path;
    },
  };
  return { chrome, page, close: () => chrome.kill("SIGKILL") };
};

const PICKER = "[data-slot=window-picker]";
const rowNamed = (name) => "[...document.querySelectorAll('" + PICKER + " .picker-row')].find((b) => (b.getAttribute('aria-label') || '').startsWith(" + JSON.stringify(name) + "))";
const playerCardNamed = (name) => "[...document.querySelectorAll('" + PICKER + " [data-slot=player-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(" + JSON.stringify(name) + "))";
const CONFIRM = "[...document.querySelectorAll('" + PICKER + " button')].find((b) => b.textContent.trim() === 'Confirm')";
const buttonText = (name) => "[...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(" + JSON.stringify(name) + "))";

const selectThenConfirm = async (page, row) => {
  if (!(await page.clickReal(row))) return false;
  const enabled = await page.waitFor("[...document.querySelectorAll('" + PICKER + " button')].some((b) => b.textContent.trim() === 'Confirm' && !b.disabled)", { timeoutMs: 4000 });
  if (!enabled) return false;
  return page.clickReal(CONFIRM);
};

const readRows = (page, labels) => page.eval(
  "(() => {" +
  " const rows = [...document.querySelectorAll('" + PICKER + " .picker-row')];" +
  " const labels = " + JSON.stringify(labels) + ";" +
  " const out = {};" +
  " for (const label of labels) {" +
  "   const r = rows.find((x) => (x.getAttribute('aria-label') || '').startsWith(label));" +
  "   if (!r) { out[label] = { present: false }; continue; }" +
  "   const svg = r.querySelector('svg');" +
  "   const initial = [...r.querySelectorAll('span')].some((s) => s.children.length === 0 && s.textContent.trim() === label.slice(0, 1));" +
  "   out[label] = { present: true, iconClass: svg ? svg.getAttribute('class') : null, initialFallback: initial };" +
  " }" +
  " return out;" +
  "})()",
);

const expectIcon = (rows, label, wantClass) => {
  const row = rows[label];
  if (!row || !row.present) { fail("no window row labelled " + JSON.stringify(label)); return; }
  if (row.initialFallback) { fail(label + " row still renders the initial-letter fallback"); return; }
  if (row.iconClass === null || !row.iconClass.includes(wantClass)) { fail(label + " row icon is " + JSON.stringify(row.iconClass) + ", expected a class containing " + JSON.stringify(wantClass)); return; }
  pass(label + " row renders " + wantClass + " (" + row.iconClass + ")");
};

const main = async () => {
  const { server, reused } = await startServer();
  if (reused) console.warn("note: reusing an already-running dev server; not validated as this checkout");
  const host = await signUp("host");
  const guest = await signUp("guest");
  pass("created accounts " + host.email + " and " + guest.email);

  const hostBrowser = await launchBrowser("host", PORT + 41);
  const guestBrowser = await launchBrowser("guest", PORT + 42);
  try {
    await hostBrowser.page.setViewport(1280, 1000);
    await guestBrowser.page.setViewport(1280, 1000);
    await hostBrowser.page.setSessionCookie(host);
    await guestBrowser.page.setSessionCookie(guest);

    await hostBrowser.page.goto(BASE + "/rooms/new");
    await hostBrowser.page.waitForHydration();
    const pickerReady = await hostBrowser.page.waitFor("document.querySelectorAll('[data-role-option]').length === 31", { timeoutMs: 15000 });
    if (!pickerReady) throw new Error("the create page never rendered the 31-role picker");
    pass("create page hydrated with the 31-role picker");

    // reka-ui's Select ignores a synthetic pointer click on the trigger; focus it
    // and open from the keyboard, retrying across key events until the listbox shows.
    let opened = false;
    for (let attempt = 0; attempt < 4 && !opened; attempt++) {
      await hostBrowser.page.focus("document.querySelector('#seats')");
      await delay(300);
      for (const key of [["Enter", "Enter", 13], [" ", "Space", 32], ["ArrowDown", "ArrowDown", 40]]) {
        await hostBrowser.page.key(key[0], key[1], key[2]);
        opened = await hostBrowser.page.waitFor("document.querySelectorAll('[role=option]').length >= 7", { timeoutMs: 1500 });
        if (opened) break;
      }
    }
    if (!opened) throw new Error("the seats select did not open");
    await hostBrowser.page.clickReal("[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === '2')");
    const closed = await hostBrowser.page.waitFor("document.querySelectorAll('[role=option]').length === 0", { timeoutMs: 4000 });
    if (!closed) throw new Error("the seats select did not close after picking");
    const seatsValue = await hostBrowser.page.eval("document.querySelector('#seats')?.textContent.trim()");
    if (seatsValue !== "2") throw new Error("seats select shows " + JSON.stringify(seatsValue) + ", expected \"2\"");
    pass("set the room to 2 seats");

    await hostBrowser.page.clickReal(buttonText("Create room"));
    const inLobby = await hostBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8,9}$/.test(location.pathname)", { timeoutMs: 20000 });
    if (!inLobby) throw new Error("create did not land in the lobby, at " + (await hostBrowser.page.url()));
    const code = (await hostBrowser.page.url()).replace("/rooms/", "");
    pass("host created room " + code);

    await guestBrowser.page.goto(BASE + "/join/" + code);
    const guestInLobby = await guestBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8,9}$/.test(location.pathname)", { timeoutMs: 20000 });
    if (!guestInLobby) throw new Error("guest link did not land in the lobby, at " + (await guestBrowser.page.url()));
    pass("guest joined through the shared link");

    let full = await hostBrowser.page.waitFor("document.body.innerText.includes('All seats filled')", { timeoutMs: 15000 });
    if (!full) { await hostBrowser.page.goto(BASE + "/rooms/" + code); full = await hostBrowser.page.waitFor("document.body.innerText.includes('All seats filled')", { timeoutMs: 15000 }); }
    if (!full) throw new Error("room " + code + " never became full for the host");
    await hostBrowser.page.clickReal(buttonText("Start game"));
    const onGame = await hostBrowser.page.waitFor("/^\\/games\\/[A-Z]{8,9}$/.test(location.pathname)", { timeoutMs: 15000 });
    if (!onGame) throw new Error("Start game did not open the board, at " + (await hostBrowser.page.url()));
    pass("host's Start game opened the board");

    await guestBrowser.page.goto(BASE + "/games/" + code);
    await hostBrowser.page.waitForHydration();
    await guestBrowser.page.waitForHydration();
    const hostBoard = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    const guestBoard = await guestBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    if (!hostBoard || !guestBoard) throw new Error("board missing (host " + hostBoard + ", guest " + guestBoard + ")");
    pass("both seats rendered the game board");

    const hostTurn = await hostBrowser.page.waitFor("!!document.querySelector('" + PICKER + "')", { timeoutMs: 20000 });
    if (!hostTurn) throw new Error("host never saw the turn window");
    if (!(await selectThenConfirm(hostBrowser.page, rowNamed("Income")))) throw new Error("host could not take Income");
    pass("host took Income; the turn passes to the guest");

    const guestTurn = await guestBrowser.page.waitFor("!!document.querySelector('" + PICKER + "')", { timeoutMs: 15000 });
    if (!guestTurn) throw new Error("guest never saw the turn window");
    if (!(await selectThenConfirm(guestBrowser.page, rowNamed("Income")))) throw new Error("guest could not take Income");
    pass("guest took Income; the turn returns to the host");

    const hostAgain = await hostBrowser.page.waitFor("!!document.querySelector('" + PICKER + "')", { timeoutMs: 15000 });
    if (!hostAgain) throw new Error("host never regained the turn window");
    const clickedPolitician = await hostBrowser.page.clickReal(rowNamed("Politician"));
    if (!clickedPolitician) throw new Error("host could not select the Politician card");
    const targetShown = await hostBrowser.page.waitFor("!!document.querySelector('" + PICKER + " [data-slot=player-card]')", { timeoutMs: 6000 });
    if (!targetShown) throw new Error("selecting Politician did not open a player-card target stage");
    const pickedTarget = await hostBrowser.page.clickReal(playerCardNamed(guest.name), { attempts: 8 });
    if (!pickedTarget) throw new Error("host could not pick the target " + guest.name);
    await hostBrowser.page.clickReal(CONFIRM);
    pass("host claimed Politician targeting the guest");

    const guestChallenge = await guestBrowser.page.waitFor("!!document.querySelector('" + PICKER + "')", { timeoutMs: 15000 });
    if (!guestChallenge) throw new Error("the guest never saw the challenge window");
    const challengeRows = await readRows(guestBrowser.page, ["Challenge", "Pass"]);
    info("challenge window rows: " + JSON.stringify(challengeRows));
    expectIcon(challengeRows, "Challenge", "lucide-swords");
    expectIcon(challengeRows, "Pass", "lucide-hand");
    const shot1 = await guestBrowser.page.screenshot("window-icons-01-challenge");
    console.log("screenshot: " + shot1);

    if (!(await selectThenConfirm(guestBrowser.page, rowNamed("Challenge")))) throw new Error("guest could not Challenge");

    const hostProof = await hostBrowser.page.waitFor("[...document.querySelectorAll('" + PICKER + " h2')].some((h) => h.textContent.trim() === 'Prove your claim')", { timeoutMs: 15000 });
    if (!hostProof) fail("host never saw the proof window; body: " + (await hostBrowser.page.bodyText()).replace(/\n/g, " | "));
    const proofRows = await readRows(hostBrowser.page, ["Show", "Concede"]);
    info("proof window rows: " + JSON.stringify(proofRows));
    expectIcon(proofRows, "Show", "lucide-eye");
    expectIcon(proofRows, "Concede", "lucide-flag");
    const shot2 = await hostBrowser.page.screenshot("window-icons-02-proof");
    console.log("screenshot: " + shot2);

    console.log("\nRESULT: challenge " + JSON.stringify(challengeRows) + " proof " + JSON.stringify(proofRows));
  } finally {
    hostBrowser.close();
    guestBrowser.close();
    if (server) { server.kill("SIGTERM"); await delay(1500); if (!server.killed) server.kill("SIGKILL"); }
  }
};

try { await main(); } catch (error) { fail(error.stack ?? error.message); }

if (failures.length > 0) { console.error("\n" + failures.length + " check(s) failed"); if (!KEEP) process.exitCode = 1; }
else console.log("\nall window-icon proof checks passed");
