// Proves the board's role-guide button: the help button renders in the table box,
// a click opens the drawer, and the drawer lays the in-play roles out in the same
// horizontally scrollable strip the room page uses.
//
// Usage: node scripts/proof-role-guide.mjs [--port 3010] [--keep]
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3010"));
const KEEP = args.includes("--keep");
const BASE = "http://localhost:" + PORT;
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = argOf("--out", new URL("../.audit/proof/", import.meta.url).pathname);
const STAMP = Date.now();
const PASSWORD = "proof-password-123";

const failures = [];
const fail = (msg) => { failures.push(msg); console.error("FAIL: " + msg); };
const pass = (msg) => console.log("PASS: " + msg);
const info = (msg) => console.log("INFO: " + msg);

mkdirSync(OUT, { recursive: true });

const serverAnswers = async () => {
  try { return (await fetch(BASE + "/api/auth/ok")).ok; } catch { return false; }
};
const startServer = async () => {
  if (await serverAnswers()) return { server: null, reused: true };
  const server = spawn("pnpm", ["exec", "nuxt", "dev", "--port", String(PORT), "--host", "localhost"], {
    cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" },
  });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 180; i++) { if (await serverAnswers()) return { server }; await delay(1000); }
  throw new Error("dev server never became ready:\n" + log);
};

const signUp = async (label) => {
  const email = "role-guide-" + label + "-" + STAMP + "@example.com";
  const res = await fetch(BASE + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name: label }),
  });
  if (res.status !== 200) throw new Error("sign-up " + label + " returned " + res.status + ": " + (await res.text()));
  const body = await res.json();
  const cookie = res.headers.get("set-cookie");
  const pair = cookie.split(";")[0];
  const eq = pair.indexOf("=");
  return { id: body.user.id, name: label, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const launchBrowser = async (label, debugPort) => {
  const profileDir = "/tmp/proof-role-guide-" + label + "-" + PORT + "-" + process.pid;
  rmSync(profileDir, { recursive: true, force: true });
  const chrome = spawn("/usr/bin/google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--user-data-dir=" + profileDir, "--remote-debugging-port=" + debugPort,
    "--remote-allow-origins=*", "about:blank",
  ], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch("http://127.0.0.1:" + debugPort + "/json/version"); if (r.ok) { wsUrl = (await r.json()).webSocketDebuggerUrl; break; } } catch {}
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
      await send("Page.navigate", { url }, session); await loaded; await delay(waitMs);
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
    async screenshot(name) { const { result } = await send("Page.captureScreenshot", { format: "png" }, session); const path = OUT + name + ".png"; writeFileSync(path, Buffer.from(result.data, "base64")); return path; },
  };
  return { chrome, page, close: () => chrome.kill("SIGKILL") };
};

const EL = {
  help: "[data-slot=game-board] button[aria-label='Role guide']",
  guide: "[data-slot=role-guide]",
};

const apiPost = async (path, user, body) => {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      origin: BASE,
      cookie: user.cookieName + "=" + user.cookieValue,
      ...(body === null ? {} : { "content-type": "application/json" }),
    },
    ...(body === null ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  if (res.status >= 400) throw new Error("POST " + path + " -> " + res.status + ": " + text);
  return { status: res.status, body: text === "" ? null : JSON.parse(text) };
};

const main = async () => {
  const started = await startServer();
  const server = started.server;
  if (started.reused) info("reusing the dev server already listening on " + PORT);
  try {
    const host = await signUp("host");
    const guest = await signUp("guest");
    pass("created accounts " + host.name + " and " + guest.name);
    const hostBrowser = await launchBrowser("host", PORT + 61);
    const guestBrowser = await launchBrowser("guest", PORT + 62);
    try {
      await hostBrowser.page.setViewport(1280, 1000);
      await guestBrowser.page.setViewport(1280, 1000);
      await hostBrowser.page.setSessionCookie(host);
      await guestBrowser.page.setSessionCookie(guest);

      const created = await apiPost("/api/rooms", host, {
        name: "Role guide proof",
        seats: 2,
        roles: ["banker", "director", "guerrilla", "politician", "peacekeeper"],
      });
      const code = created.body.room.code;
      pass("host created room " + code + " with the five starter roles");
      await apiPost("/api/rooms/" + code + "/join", guest, null);
      pass("guest joined the room");
      await apiPost("/api/rooms/" + code + "/start", host, null);
      pass("host started the game");

      await hostBrowser.page.goto(BASE + "/games/" + code);
      await guestBrowser.page.goto(BASE + "/games/" + code);
      await hostBrowser.page.waitForHydration();
      await guestBrowser.page.waitForHydration();
      const hostBoard = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
      if (!hostBoard) {
        info("host game page body: " + (await hostBrowser.page.bodyText()).replace(/\n/g, " | "));
        info("host game path: " + (await hostBrowser.page.url()));
        throw new Error("the host board never rendered");
      }
      pass("the host board rendered");

      const seatCount = await hostBrowser.page.eval("document.querySelectorAll('[data-slot=game-board] [data-seat]').length");
      info("board seats rendered: " + seatCount);

      const placement = await hostBrowser.page.eval("(() => { const board = document.querySelector('[data-slot=game-board]'); const box = board && board.querySelector(':scope > div'); const help = board && board.querySelector(\"button[aria-label='Role guide']\"); const puck = board && board.querySelector('[data-slot=table-puck]'); if (!box || !help) return null; const wrap = help.parentElement; const b = box.getBoundingClientRect(); const h = help.getBoundingClientRect(); const overlap = (r) => !(h.right <= r.left || h.left >= r.right || h.bottom <= r.top || h.top >= r.bottom); const puckContent = puck ? [...puck.children].map((c) => c.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0) : []; return { insideBox: box.contains(help), boxPosition: getComputedStyle(box).position, wrapPosition: getComputedStyle(wrap).position, topRight: h.left > b.left + b.width / 2 && h.top < b.top + b.height / 2, puckParts: puckContent.length, overlapsPuck: puckContent.some(overlap), box: { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }, help: { x: Math.round(h.left), y: Math.round(h.top), w: Math.round(h.width), h: Math.round(h.height) } }; })()");
      info("placement: " + JSON.stringify(placement));
      if (placement === null) fail("the role-guide button or its table box is missing");
      else {
        if (placement.insideBox) pass("the button is inside the table box");
        else fail("the button is outside the table box");
        if (placement.boxPosition === "relative" && placement.wrapPosition === "absolute") pass("the box is relative and the button wrapper absolute, so it overlays without shifting the puck");
        else fail("box/wrapper position is " + placement.boxPosition + "/" + placement.wrapPosition + ", expected relative/absolute");
        if (placement.topRight) pass("the button sits in the table box's top-right");
        else fail("the button is not in the top-right of the table box");
        if (placement.overlapsPuck === false) pass("the button clears all " + placement.puckParts + " puck content blocks");
        else if (placement.overlapsPuck === true) fail("the button overlaps the table puck's content");
        else info("no table puck content to compare against");
      }

      const shotBefore = await hostBrowser.page.screenshot("role-guide-01-board");
      console.log("screenshot: " + shotBefore);

      const guideBefore = await hostBrowser.page.eval("!!document.querySelector(" + JSON.stringify(EL.guide) + ")");
      if (guideBefore) fail("the drawer content is present before any click");
      else pass("the drawer is closed before the click");

      const clicked = await hostBrowser.page.clickReal("document.querySelector(" + JSON.stringify(EL.help) + ")");
      if (!clicked) fail("the role-guide button was not clickable");
      else pass("clicked the role-guide button");

      const drawerOpen = await hostBrowser.page.waitFor("!!document.querySelector(" + JSON.stringify(EL.guide) + ")", { timeoutMs: 5000 });
      if (!drawerOpen) fail("the drawer did not open; body: " + (await hostBrowser.page.bodyText()).replace(/\n/g, " | "));
      else pass("the drawer opened");

      const guide = await hostBrowser.page.eval("(() => { const g = document.querySelector(" + JSON.stringify(EL.guide) + "); if (!g) return null; const strip = g.querySelector('[data-slot=role-strip]'); return { title: g.querySelector('[data-slot=drawer-title]')?.textContent.trim() ?? null, cards: g.querySelectorAll('[data-slot=role-card]').length, hasStrip: !!strip, overflowX: strip ? getComputedStyle(strip).overflowX : null, scrollW: strip ? strip.scrollWidth : null, clientW: strip ? strip.clientWidth : null, cardW: strip && strip.firstElementChild ? Math.round(strip.firstElementChild.getBoundingClientRect().width) : null }; })()");
      info("drawer: " + JSON.stringify(guide));
      if (guide === null) { fail("could not read the drawer"); }
      else {
        if (guide.title === "Roles in play") pass("the drawer titles itself " + JSON.stringify(guide.title));
        else fail("the drawer title is " + JSON.stringify(guide.title));
        if (guide.cards > 0) pass("the drawer renders " + guide.cards + " role cards");
        else fail("the drawer renders no role cards");
        if (!guide.hasStrip) fail("the drawer has no [data-slot=role-strip]");
        else pass("the roles sit in a [data-slot=role-strip]");
        if (guide.overflowX !== "auto") fail("the strip overflowX is " + guide.overflowX + ", expected auto");
        else pass("the strip scrolls horizontally (overflow-x: auto)");
        if (guide.cardW === 160) pass("each role card is w-40 (160px), matching the room strip");
        else fail("role card width is " + guide.cardW + "px, expected 160");
        const roomStrip = await hostBrowser.page.eval("(() => { const s = document.querySelector('[data-slot=role-strip]'); return s ? s.className : null; })()");
        info("strip class: " + JSON.stringify(roomStrip));
      }

      const shotAfter = await hostBrowser.page.screenshot("role-guide-02-open");
      console.log("screenshot: " + shotAfter);

      const stripClasses = await hostBrowser.page.eval("(() => { const g = document.querySelector(" + JSON.stringify(EL.guide) + "); const s = g && g.querySelector('[data-slot=role-strip]'); return s ? s.className : null; })()");
      const expected = "flex gap-3 overflow-x-auto -mx-1 -mt-1 px-1 pt-1 pb-3";
      if (stripClasses === expected) pass("the drawer strip reuses ROLE_STRIP_CLASS verbatim");
      else fail("strip class is " + JSON.stringify(stripClasses) + ", expected " + JSON.stringify(expected));

      await hostBrowser.page.clickReal("document.querySelector('[data-slot=drawer-overlay]')");
      const closed = await hostBrowser.page.waitFor("!document.querySelector(" + JSON.stringify(EL.guide) + ")", { timeoutMs: 5000 });
      if (!closed) fail("the drawer did not close on outside click");
      else pass("the drawer closes on an outside click");

      await hostBrowser.page.screenshot("role-guide-03-closed");

      await hostBrowser.page.setViewport(390, 844);
      await hostBrowser.page.clickReal("document.querySelector(" + JSON.stringify(EL.help) + ")");
      const narrowOpen = await hostBrowser.page.waitFor("!!document.querySelector(" + JSON.stringify(EL.guide) + ")", { timeoutMs: 5000 });
      if (!narrowOpen) fail("the drawer did not open at phone width");
      else {
        const scroll = await hostBrowser.page.eval("(() => { const g = document.querySelector(" + JSON.stringify(EL.guide) + "); const s = g && g.querySelector('[data-slot=role-strip]'); if (!s) return null; const before = s.scrollLeft; s.scrollLeft = 400; return { overflow: s.scrollWidth - s.clientWidth, before, after: s.scrollLeft }; })()");
        info("narrow strip: " + JSON.stringify(scroll));
        if (scroll === null) fail("no strip at phone width");
        else if (scroll.overflow <= 0) fail("the strip does not overflow at phone width (overflow " + scroll.overflow + ")");
        else if (scroll.after <= scroll.before) fail("the strip did not scroll right: " + JSON.stringify(scroll));
        else pass("the strip overflows by " + scroll.overflow + "px and scrolls to " + scroll.after + " at phone width");
        await hostBrowser.page.screenshot("role-guide-04-narrow");
      }
    } finally {
      hostBrowser.close();
      guestBrowser.close();
    }
    if (failures.length > 0) { console.error("\n" + failures.length + " check(s) failed"); process.exitCode = 1; }
    else console.log("\nall role-guide proof checks passed");
  } finally {
    if (server) server.kill("SIGKILL");
  }
};

await main();
