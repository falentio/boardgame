// Usage: node scripts/proof-create-room-confirm.mjs [--port 3287] [--keep]
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3287"));
const KEEP = args.includes("--keep");
const BASE = `http://localhost:${PORT}`;
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = argOf("--out", new URL("../.audit/proof/", import.meta.url).pathname);
const STAMP = Date.now();
const PASSWORD = "proof-password-123";
const ROOM_NAME = "Movie night";
const SEATS = 3;

const failures = [];
const fail = (msg) => { failures.push(msg); console.error(`FAIL: ${msg}`); };
const pass = (msg) => console.log(`PASS: ${msg}`);

mkdirSync(OUT, { recursive: true });

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

const signUp = async () => {
  const email = `confirm-${STAMP}@example.com`;
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name: "Confirm Proof" }),
  });
  if (res.status !== 200) throw new Error(`sign-up returned ${res.status}: ${await res.text()}`);
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("sign-up set no cookie");
  const [pair] = cookie.split(";");
  const eq = pair.indexOf("=");
  return { cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const launchBrowser = async (label, debugPort) => {
  const profileDir = `/tmp/proof-confirm-${label}-${PORT}-${process.pid}`;
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
      await delay(300);
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
    async waitFor(expression, { timeoutMs = 10000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) { if (await page.eval(`!!(${expression})`)) return true; await delay(200); }
      return false;
    },
    async waitForHydration({ timeoutMs = 30000 } = {}) {
      const ok = await page.waitFor("document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__", { timeoutMs });
      if (!ok) throw new Error("Vue never hydrated");
      return true;
    },
    // A hydration marker appears before a control's listener is live, so the
    // first click can be dropped; retry until the effect shows.
    async clickUntil(selector, effect, { attempts = 10 } = {}) {
      const effectMet = () => page.eval(`!!(${effect})`);
      for (let i = 0; i < attempts; i++) {
        if (await effectMet()) return true;
        const ok = await page.eval(
          `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`,
        );
        if (!ok) { if (await effectMet()) return true; throw new Error(`clickUntil: no element for ${selector}`); }
        for (let wait = 0; wait < 8; wait++) { if (await effectMet()) return true; await delay(200); }
      }
      return false;
    },
    async rectOf(jsEl) {
      return page.eval(`(() => { const el = ${jsEl}; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    },
    async mouseClick(x, y) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 }, session);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 }, session);
      await delay(80);
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 }, session);
    },
    // reka-ui opens its select on pointerdown, so a synthetic click no-ops; a
    // real mouse press on the trigger's rect is what a user does. A dialog's
    // open animation moves the target, so the rect must read the same twice.
    async clickElement(jsEl, effect, { attempts = 8 } = {}) {
      for (let i = 0; i < attempts; i++) {
        if (await page.eval(`!!(${effect})`)) return true;
        const first = await page.rectOf(jsEl);
        if (first === null) { await delay(250); continue; }
        await delay(200);
        const again = await page.rectOf(jsEl);
        if (again === null || Math.abs(first.x - again.x) >= 2 || Math.abs(first.y - again.y) >= 2) continue;
        await page.mouseClick(again.x, again.y);
        for (let wait = 0; wait < 6; wait++) {
          if (await page.eval(`!!(${effect})`)) return true;
          await delay(200);
        }
      }
      return false;
    },
    async pressEscape() {
      const key = { key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
      await send("Input.dispatchKeyEvent", { type: "keyDown", ...key }, session);
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...key }, session);
      await delay(400);
    },
    async screenshot(name) {
      const { result } = await send("Page.captureScreenshot", { format: "png" }, session);
      const path = `${OUT}${name}.png`;
      writeFileSync(path, Buffer.from(result.data, "base64"));
      return path;
    },
  };
  return { chrome, page, on, close: () => chrome.kill("SIGKILL") };
};

const SUBMIT = "button[type=submit]";
const DIALOG = "[role=alertdialog]";
const CREATE_BUTTON =
  `(() => [...document.querySelectorAll('[role=alertdialog] button')].find((b) => b.textContent.trim() === "Create room") ?? null)()`;

const main = async () => {
  const { server, reused } = await startServer();
  if (reused) console.warn("note: reusing an already-running dev server; not validated as this checkout");
  let browser = null;
  try {
    const user = await signUp();
    pass("created the proof account");

    browser = await launchBrowser("main", PORT + 61);
    let posts = 0;
    browser.on("Network.requestWillBeSent", (params) => {
      if (params.request.method !== "POST") return;
      try { if (new URL(params.request.url).pathname === "/api/rooms") posts++; } catch {}
    });

    await browser.page.setViewport(1280, 900);
    await browser.page.setSessionCookie(user);
    await browser.page.goto(`${BASE}/rooms/new`);
    const onForm = await browser.page.waitFor("location.pathname === '/rooms/new'", { timeoutMs: 15000 });
    if (!onForm) throw new Error(`did not land on the create form, at ${await browser.page.eval("location.pathname")}`);
    await browser.page.waitForHydration();
    const pickerReady = await browser.page.waitFor("document.querySelectorAll('[data-role-option]').length === 31");
    if (!pickerReady) throw new Error("the role picker never rendered every role");
    await browser.page.waitFor(`document.querySelectorAll('[data-role-option][aria-pressed=true]').length === 5`);

    await browser.page.eval(
      `(() => { const input = document.querySelector('#room-name'); const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, ${JSON.stringify(ROOM_NAME)}); input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`,
    );
    const seatOption = `[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === ${JSON.stringify(String(SEATS))})`;
    const selectOpen = await browser.page.clickElement(
      "document.querySelector('#seats')",
      "document.querySelector('[role=listbox], [data-slot=select-content]')",
    );
    if (!selectOpen) throw new Error("the seats select never opened");
    const seatPicked = await browser.page.clickElement(
      seatOption,
      `document.querySelector('#seats').textContent.trim() === ${JSON.stringify(String(SEATS))}`,
    );
    if (!seatPicked) throw new Error(`could not pick ${SEATS} seats from the select`);
    await delay(400);
    pass(`filled the form with ${JSON.stringify(ROOM_NAME)} and ${SEATS} seats`);

    const formRoles = await browser.page.eval(
      "(() => [...document.querySelectorAll('[data-role-option][aria-pressed=true]')].map((c) => c.getAttribute('aria-label')).sort())()",
    );

    const opened = await browser.page.clickUntil(SUBMIT, `document.querySelector(${JSON.stringify(DIALOG)})`);
    if (!opened) fail("clicking the form's Create room did not open an alertdialog");
    else pass("clicking the form's Create room opened the confirm dialog");
    if (posts !== 0) fail(`the form's Create room posted ${posts} time(s); it must only open the dialog`);
    else pass("the form's Create room sent zero POST /api/rooms");

    const dialog = await browser.page.eval(`(() => {
      const d = document.querySelector(${JSON.stringify(DIALOG)});
      if (!d) return null;
      const title = d.querySelector('[data-slot=alert-dialog-title]');
      const strip = d.querySelector('[data-slot=role-strip]');
      const cards = strip ? [...strip.querySelectorAll('[data-slot=role-card]')] : [];
      return {
        title: title ? title.textContent.trim() : null,
        text: d.innerText,
        roles: cards.map((c) => c.getAttribute('aria-label')).sort(),
        cardCount: cards.length,
      };
    })()`);
    if (dialog === null) {
      fail("the confirm dialog could not be read");
    } else {
      if (dialog.title === "Create this room?") pass(`the dialog title reads ${JSON.stringify(dialog.title)}`);
      else fail(`the dialog title should read "Create this room?", got ${JSON.stringify(dialog.title)}`);
      if (dialog.text.includes(ROOM_NAME) && dialog.text.includes(`${SEATS} seats`)) pass(`the dialog restates ${JSON.stringify(ROOM_NAME)} and ${SEATS} seats`);
      else fail(`the dialog should restate ${JSON.stringify(ROOM_NAME)} and ${SEATS} seats, got: ${dialog.text.replace(/\n/g, " | ")}`);
      if (dialog.cardCount === 5) pass("the dialog's role strip holds 5 role cards");
      else fail(`the dialog's role strip should hold 5 role cards, got ${dialog.cardCount}`);
      const sameRoles = JSON.stringify(dialog.roles) === JSON.stringify(formRoles);
      if (sameRoles) pass("the dialog's role cards match the roles selected on the form");
      else fail(`the dialog's roles ${JSON.stringify(dialog.roles)} differ from the form's ${JSON.stringify(formRoles)}`);
    }

    const shot = await browser.page.screenshot("create-room-confirm-dialog");
    console.log(`screenshot: ${shot}`);

    const fits = await browser.page.eval(`(() => {
      const d = document.querySelector(${JSON.stringify(DIALOG)});
      if (!d) return null;
      const r = d.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, innerHeight: window.innerHeight };
    })()`);
    if (fits === null) fail("the dialog rect could not be measured");
    else if (fits.top >= 0 && fits.bottom <= fits.innerHeight) pass(`the dialog fits the viewport (top ${fits.top.toFixed(1)}, bottom ${fits.bottom.toFixed(1)}, height ${fits.innerHeight})`);
    else fail(`the dialog overflows the viewport: top ${fits.top}, bottom ${fits.bottom}, height ${fits.innerHeight}`);

    const scroll = await browser.page.eval(`(() => {
      const d = document.querySelector(${JSON.stringify(DIALOG)});
      if (!d) return null;
      const strip = d.querySelector('[data-slot=role-strip]');
      if (!strip) return null;
      const dlgBefore = d.scrollLeft;
      d.scrollLeft = 99999;
      const dlgScrolled = d.scrollLeft;
      d.scrollLeft = dlgBefore;
      const stripBefore = strip.scrollLeft;
      strip.scrollLeft = 99999;
      const stripScrolled = strip.scrollLeft;
      strip.scrollLeft = stripBefore;
      return {
        dialogOverflow: d.scrollWidth - d.clientWidth,
        dialogScrolled: dlgScrolled,
        stripOverflow: strip.scrollWidth - strip.clientWidth,
        stripScrolled: stripScrolled,
      };
    })()`);
    if (scroll === null) {
      fail("the dialog's scroll behaviour could not be measured");
    } else {
      if (scroll.dialogOverflow === 0 && scroll.dialogScrolled === 0) pass("the dialog does not scroll horizontally");
      else fail(`the dialog scrolls horizontally (overflow ${scroll.dialogOverflow}px, scrolled to ${scroll.dialogScrolled})`);
      if (scroll.stripOverflow > 0 && scroll.stripScrolled > 0) pass(`only the role strip scrolls (overflow ${scroll.stripOverflow}px)`);
      else fail(`the role strip should be the horizontal scroller, overflow ${scroll.stripOverflow}px scrolled to ${scroll.stripScrolled}`);
    }

    await browser.page.pressEscape();
    const closed = await browser.page.waitFor(`!document.querySelector(${JSON.stringify(DIALOG)})`, { timeoutMs: 5000 });
    if (!closed) fail("Escape did not close the confirm dialog");
    else pass("Escape closed the confirm dialog");
    if (posts !== 0) fail(`Escape posted ${posts} time(s); it must not create the room`);
    else pass("Escape still sent zero POST /api/rooms");
    const focusBack = await browser.page.waitFor(
      `document.activeElement === document.querySelector(${JSON.stringify(SUBMIT)})`,
      { timeoutMs: 5000 },
    );
    if (focusBack) pass("focus returned to the form's submit button");
    else {
      const active = await browser.page.eval("(() => { const a = document.activeElement; return a ? a.tagName + '#' + (a.id || '') + '.' + (a.className || '') : null; })()");
      fail(`focus should return to the form's submit button, activeElement is ${active}`);
    }

    const reopened = await browser.page.clickUntil(SUBMIT, `document.querySelector(${JSON.stringify(DIALOG)})`);
    if (!reopened) fail("the dialog did not reopen after Escape");
    else pass("the dialog reopened");
    const confirmed = await browser.page.clickElement(
      CREATE_BUTTON,
      "/^\\/rooms\\/[A-Z]{8,9}$/.test(location.pathname)",
      { attempts: 6 },
    );
    const inLobby = await browser.page.waitFor("/^\\/rooms\\/[A-Z]{8,9}$/.test(location.pathname)", { timeoutMs: 20000 });
    if (!confirmed || !inLobby) fail(`the dialog's Create room did not reach the lobby, at ${await browser.page.eval("location.pathname")}`);
    else pass(`the dialog's Create room landed on ${await browser.page.eval("location.pathname")}`);
    if (posts === 1) pass("the dialog's Create room sent exactly one POST /api/rooms");
    else fail(`expected exactly one POST /api/rooms, counted ${posts}`);
  } finally {
    if (browser !== null) browser.close();
    if (server) { server.kill("SIGTERM"); await delay(1500); if (!server.killed) server.kill("SIGKILL"); }
  }
};

try { await main(); } catch (error) { fail(error.stack ?? error.message); }
if (failures.length > 0) { console.error(`\n${failures.length} check(s) failed`); if (!KEEP) process.exitCode = 1; }
