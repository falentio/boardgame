// Proves an unwrap is behavior-preserving: run once with --label before against
// the old page, then with --label after --baseline <before.json> against the new
// one, and every difference outside the intended wrappers fails the run.
//
// Usage: node scripts/proof-game-page-unwrap.mjs [--port 3000] [--out DIR] [--label before|after] [--baseline FILE] [--keep]
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
const LABEL = argOf("--label", "run");
const BASELINE = argOf("--baseline", null);
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


const EXPR = {
  shell: '(function () { var main = document.querySelector("main[data-slot=sidebar-inset]"); if (!main) return null; var root = null; for (var i = 0; i < main.children.length; i += 1) { if (main.children[i].tagName === "DIV") { root = main.children[i]; break; } } if (!root) return null; var card = root.querySelector("[data-slot=card]"); var content = root.querySelector("[data-slot=card-content]"); var board = root.querySelector("[data-slot=game-board]"); var depth = null; var el = board; var d = 0; while (el && el !== root) { el = el.parentElement; d += 1; } if (el === root) depth = d; var slots = []; var all = root.querySelectorAll("[data-slot]"); for (var k = 0; k < all.length; k += 1) { var s = all[k].getAttribute("data-slot"); if (slots.indexOf(s) === -1) slots.push(s); } slots.sort(); var rr = root.getBoundingClientRect(); var br = board ? board.getBoundingClientRect() : null; var pad = function (el) { if (!el) return null; var cs = getComputedStyle(el); return { x: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), y: parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) }; }; return { rootClass: root.className, cardPresent: !!card, cardContentPresent: !!content, cardWrapsContent: !!(card && content && card.contains(content)), boardDepth: depth, slots: slots, rootRect: { x: Math.round(rr.left), y: Math.round(rr.top), w: Math.round(rr.width) }, boardRect: br ? { x: Math.round(br.left), y: Math.round(br.top), w: Math.round(br.width) } : null, contentPadX: pad(content) ? pad(content).x : null, wrapperPadY: (card ? parseFloat(getComputedStyle(card).paddingTop) : 0) + (content ? parseFloat(getComputedStyle(content).paddingTop) : 0), hScroll: document.documentElement.scrollWidth > window.innerWidth + 1 }; })()',
  text: '(function () { var main = document.querySelector("main[data-slot=sidebar-inset]"); if (!main) return null; var root = null; for (var i = 0; i < main.children.length; i += 1) { if (main.children[i].tagName === "DIV") { root = main.children[i]; break; } } if (!root) return null; var lines = root.innerText.split("\\n"); var out = []; for (var k = 0; k < lines.length; k += 1) { var s = lines[k].trim(); if (s.length > 0) out.push(s); } return out.join(" "); })()',
  firstCard: '(function () { var bs = document.querySelectorAll("[data-slot=window-picker] button"); for (var i = 0; i < bs.length; i += 1) { var b = bs[i]; var s = b.getAttribute("data-slot"); if (!b.disabled && (s === "role-card" || s === "general-action-card" || s === "player-card")) return b; } return null; })()',
  firstTarget: '(function () { var g = document.querySelector("[data-slot=window-picker] [role=group][aria-label=Target]"); if (!g) return null; var bs = g.querySelectorAll("button"); for (var i = 0; i < bs.length; i += 1) { if (!bs[i].disabled) return bs[i]; } return null; })()',
  confirm: '(function () { var bs = document.querySelectorAll("[data-slot=window-picker] button"); for (var i = 0; i < bs.length; i += 1) { if (bs[i].textContent.trim() === "Confirm") return bs[i]; } return null; })()',
  resign: '(function () { var bs = document.querySelectorAll("button"); for (var i = 0; i < bs.length; i += 1) { if (bs[i].textContent.trim() === "Resign") return bs[i]; } return null; })()',
  picker: 'document.querySelector("[data-slot=window-picker]") !== null',
  noResign: '!Array.prototype.slice.call(document.querySelectorAll("button")).some(function (b) { return b.textContent.trim() === "Resign"; })',
};

const turnExpr = (n) => '(function () { var t = document.body.innerText; var i = t.search(/turn\\s+\\d/i); if (i === -1) return false; var rest = t.slice(i).replace(/^turn\\s+/i, ""); var d = ""; for (var k = 0; k < rest.length; k += 1) { var c = rest[k]; if (c >= "0" && c <= "9") d += c; else break; } return d !== "" && Number(d) > ' + n + '; })()';

const turnNumber = async (page) => {
  const text = await page.bodyText();
  const i = text.search(/turn\s+\d/i);
  if (i === -1) return null;
  const rest = text.slice(i + 5);
  let digits = "";
  for (const ch of rest) { if (ch >= "0" && ch <= "9") digits += ch; else break; }
  return digits === "" ? null : Number(digits);
};

const capture = async (page) => ({
  shell: await page.eval(EXPR.shell),
  text: await page.eval(EXPR.text),
});

const BUTTON = (name) => "[].slice.call(document.querySelectorAll('button')).find(function (b) { return b.textContent.trim().indexOf(" + JSON.stringify(name) + ") !== -1; })";

const startGame = async (hostBrowser, guestBrowser) => {
  await hostBrowser.page.goto(BASE + "/rooms/new");
  await hostBrowser.page.waitForHydration();
  const pickerReady = await hostBrowser.page.waitFor("document.querySelectorAll('[data-role-option]').length === 31", { timeoutMs: 15000 });
  if (!pickerReady) throw new Error("the create page never rendered the 31-role picker");
  await hostBrowser.page.clickReal("document.querySelector('#seats')");
  const opened = await hostBrowser.page.waitFor("document.querySelectorAll('[role=option]').length >= 7", { timeoutMs: 4000 });
  if (!opened) throw new Error("the seats select did not open");
  await hostBrowser.page.clickReal("[].slice.call(document.querySelectorAll('[role=option]')).find(function (o) { return o.textContent.trim() === '2'; })");
  const seatsValue = await hostBrowser.page.eval("document.querySelector('#seats') ? document.querySelector('#seats').textContent.trim() : null");
  if (seatsValue !== "2") throw new Error("the seats select shows " + JSON.stringify(seatsValue) + ", expected \"2\"");
  await hostBrowser.page.clickReal(BUTTON("Create room"));
  const inLobby = await hostBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8,9}$/.test(location.pathname)", { timeoutMs: 20000 });
  if (!inLobby) throw new Error("create did not land in the lobby, at " + (await hostBrowser.page.url()));
  const code = (await hostBrowser.page.url()).replace("/rooms/", "").split("?")[0];

  let guestSeated = false;
  for (let i = 0; i < 3 && !guestSeated; i += 1) {
    await guestBrowser.page.goto(BASE + "/join/" + code, { waitMs: 2500 });
    guestSeated = await guestBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8,9}$/.test(location.pathname)", { timeoutMs: 20000 });
  }
  if (!guestSeated) throw new Error("guest never landed in the lobby, at " + (await guestBrowser.page.url()) + "; body: " + (await guestBrowser.page.bodyText()).split("\n").join(" | ").slice(0, 300));

  let occupants = 0;
  for (let i = 0; i < 20 && occupants < 2; i += 1) {
    await delay(500);
    const res = await fetch(BASE + "/api/rooms/" + code, { headers: { cookie: hostBrowser.user.cookieName + "=" + hostBrowser.user.cookieValue } });
    if (res.ok) occupants = ((await res.json()).room?.seats ?? []).filter((s) => s.occupant !== null).length;
  }
  if (occupants < 2) throw new Error("room " + code + " has " + occupants + " occupants, expected 2");

  let full = false;
  for (let i = 0; i < 4 && !full; i += 1) {
    await hostBrowser.page.goto(BASE + "/rooms/" + code, { waitMs: 1800 });
    full = await hostBrowser.page.waitFor("document.body.innerText.indexOf('All seats filled') !== -1", { timeoutMs: 8000 });
  }
  if (!full) throw new Error("room " + code + " never became full for the host");
  await hostBrowser.page.clickReal(BUTTON("Start game"));
  const onGame = await hostBrowser.page.waitFor("/^\\/games\\/[A-Z]{8,9}/.test(location.pathname)", { timeoutMs: 15000 });
  if (!onGame) throw new Error("Start game did not open the board, at " + (await hostBrowser.page.url()));
  return code;
};

const main = async () => {
  const { server, reused } = await startServer();
  if (reused) console.warn("note: reusing an already-running dev server; not validated as this checkout");
  const host = await signUp("host");
  const guest = await signUp("guest");
  const watcher = await signUp("watcher");
  pass("created accounts " + host.email + ", " + guest.email + ", " + watcher.email);

  const hostBrowser = await launchBrowser("host", PORT + 61);
  const guestBrowser = await launchBrowser("guest", PORT + 62);
  const watcherBrowser = await launchBrowser("watcher", PORT + 63);
  hostBrowser.user = host;
  try {
    for (const b of [hostBrowser, guestBrowser, watcherBrowser]) await b.page.setViewport(1440, 1000);
    await hostBrowser.page.setSessionCookie(host);
    await guestBrowser.page.setSessionCookie(guest);
    await watcherBrowser.page.setSessionCookie(watcher);

    const code = await startGame(hostBrowser, guestBrowser);
    pass("host started a 2-seat game in room " + code);

    await guestBrowser.page.goto(BASE + "/games/" + code);
    await watcherBrowser.page.goto(BASE + "/games/" + code);
    await hostBrowser.page.waitForHydration();
    await guestBrowser.page.waitForHydration();
    await watcherBrowser.page.waitForHydration();

    const live = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 20000 });
    if (!live) throw new Error("the live board never rendered; body: " + (await hostBrowser.page.bodyText()).split("\n").join(" | ").slice(0, 400));
    pass("the seated host rendered [data-slot=game-board]");

    const spectatorSeen = await watcherBrowser.page.waitFor("document.body.innerText.indexOf('You are not seated in this game') !== -1", { timeoutMs: 20000 });
    if (!spectatorSeen) throw new Error("the unseated watcher saw no spectator notice; body: " + (await watcherBrowser.page.bodyText()).split("\n").join(" | ").slice(0, 400));
    const watcherBoard = await watcherBrowser.page.eval("!!document.querySelector('[data-slot=game-board]')");
    if (watcherBoard) fail("the unseated watcher rendered a game board");
    else pass("the unseated watcher sees the spectator notice and no board");

    const pickerOpen = await hostBrowser.page.waitFor(EXPR.picker, { timeoutMs: 20000 });
    if (!pickerOpen) info("the host's turn window is not open this run; the board signature is captured as-is");
    else pass("the host's turn window is open");

    const board = await capture(hostBrowser.page);
    const spectator = await capture(watcherBrowser.page);
    info("board shell: " + JSON.stringify(board.shell));
    if (board.shell === null) throw new Error("the page root was not found on the board branch");
    if (LABEL === "before") {
      info("baseline run: the Card is expected to wrap the content here");
    } else if (board.shell.cardContentPresent) {
      fail("a [data-slot=card-content] still wraps the page content");
    } else if (board.shell.cardWrapsContent) {
      fail("a [data-slot=card] still wraps the page content");
    } else {
      pass("no Card wraps the page content");
    }
    if (board.shell.hScroll) fail("the page scrolls horizontally at 1440px");
    else pass("the page does not scroll horizontally at 1440px");

    const shot1440 = await hostBrowser.page.screenshot("unwrap-" + LABEL + "-board-1440");
    console.log("screenshot: " + shot1440);

    await hostBrowser.page.setViewport(375, 780);
    await delay(700);
    const narrow = await hostBrowser.page.eval(EXPR.shell);
    info("375 shell: " + JSON.stringify(narrow));
    if (narrow === null) fail("the page root was not found at 375px");
    else if (narrow.hScroll) fail("the page scrolls horizontally at 375px");
    else pass("the page fits at 375px with no horizontal scroll");
    const shot375 = await hostBrowser.page.screenshot("unwrap-" + LABEL + "-board-375");
    console.log("screenshot: " + shot375);
    await hostBrowser.page.setViewport(1440, 1000);
    await delay(500);

    await hostBrowser.page.goto(BASE + "/games/ZZZZZZZZ");
    const invalidSeen = await hostBrowser.page.waitFor("document.body.innerText.indexOf('That room code is not valid.') !== -1", { timeoutMs: 15000 });
    if (!invalidSeen) fail("an invalid code showed no invalid-room notice; body: " + (await hostBrowser.page.bodyText()).split("\n").join(" | ").slice(0, 300));
    else pass("an invalid code shows the invalid-room notice");
    const invalid = await capture(hostBrowser.page);

    await hostBrowser.page.goto(BASE + "/games/" + code, { waitMs: 2000 });
    const back = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 20000 });
    if (!back) throw new Error("the host board did not come back after the invalid-code visit");

    if (pickerOpen) {
      const before = await turnNumber(hostBrowser.page);
      const picked = await hostBrowser.page.clickReal(EXPR.firstCard);
      if (!picked) fail("no enabled card could be selected in the turn window");
      const hasTarget = await hostBrowser.page.waitFor("!!" + EXPR.firstTarget, { timeoutMs: 2500 });
      if (hasTarget) await hostBrowser.page.clickReal(EXPR.firstTarget);
      const confirmed = await hostBrowser.page.clickReal(EXPR.confirm);
      if (!confirmed) fail("the Confirm button could not be clicked");
      const advanced = confirmed && (before === null || (await hostBrowser.page.waitFor(turnExpr(before), { timeoutMs: 12000 })));
      if (advanced) pass("selecting a card and confirming advanced the turn (" + before + " -> " + (await turnNumber(hostBrowser.page)) + ")");
      else fail("the turn did not advance past " + before);
    }

    const resignCode = await startGame(hostBrowser, guestBrowser);
    pass("host started a second game in room " + resignCode + " to drive Resign while it owes input");
    await hostBrowser.page.goto(BASE + "/games/" + resignCode, { waitMs: 2000 });
    const owing = await hostBrowser.page.waitFor(EXPR.picker, { timeoutMs: 20000 });
    if (!owing) fail("the host's turn window never opened in the resign room, so Resign could not be driven");
    const resigned = await hostBrowser.page.clickReal(EXPR.resign);
    const over = resigned && (await hostBrowser.page.waitFor("document.body.innerText.indexOf('Game over') !== -1 || document.body.innerText.indexOf('Winner') !== -1", { timeoutMs: 15000 }));
    if (over) pass("Resign ended the game and the result card appeared");
    else fail("Resign showed no result card; body: " + (await hostBrowser.page.bodyText()).split("\n").join(" | ").slice(0, 400));
    const noResign = await hostBrowser.page.eval(EXPR.noResign);
    if (noResign) pass("the Resign button is gone once the game is over");
    else fail("the Resign button is still present after the game ended");
    const shotOver = await hostBrowser.page.screenshot("unwrap-" + LABEL + "-game-over");
    console.log("screenshot: " + shotOver);

    const signature = { label: LABEL, pickerOpen, board, spectator, invalid, narrowShell: narrow };
    const sigPath = OUT + "game-page-unwrap-" + LABEL + ".json";
    writeFileSync(sigPath, JSON.stringify(signature, null, 2) + "\n");
    console.log("signature: " + sigPath);

    if (BASELINE !== null) {
      const base = JSON.parse(readFileSync(BASELINE, "utf8"));
      if (!base.board.shell.cardWrapsContent) fail("the baseline was not captured with a Card wrapping the content");
      else pass("the baseline was captured with a Card wrapping the content");
      if (base.board.shell.boardDepth !== 4) fail("the baseline board depth was " + base.board.shell.boardDepth + ", expected 4 with the Card in place");
      else pass("the baseline board sat 4 levels under the page root");

      for (const key of ["board", "spectator", "invalid"]) {
        if (base[key].shell.rootClass !== signature[key].shell.rootClass) {
          fail("the " + key + " page-root class changed: " + JSON.stringify(base[key].shell.rootClass) + " -> " + JSON.stringify(signature[key].shell.rootClass));
        } else pass("the " + key + " page-root class matches the baseline");

        const removed = base[key].shell.slots.filter((s) => signature[key].shell.slots.indexOf(s) === -1);
        const added = signature[key].shell.slots.filter((s) => base[key].shell.slots.indexOf(s) === -1);
        const onlyCardSlots = removed.every((s) => s === "card" || s === "card-content") && added.length === 0;
        if (!onlyCardSlots) {
          fail("the " + key + " slot set changed beyond the Card: removed " + JSON.stringify(removed) + ", added " + JSON.stringify(added));
        } else if (removed.length > 0) {
          pass("the " + key + " slot set dropped only " + JSON.stringify(removed) + " (the Card's slots)");
        } else pass("the " + key + " slot set is unchanged");
      }

      for (const key of ["spectator", "invalid"]) {
        if (base[key].text !== signature[key].text) {
          fail("the " + key + " text changed");
          console.error("  baseline: " + JSON.stringify(base[key].text));
          console.error("  current:  " + JSON.stringify(signature[key].text));
        } else pass("the " + key + " text matches the baseline");
      }

      const depthDelta = base.board.shell.boardDepth - signature.board.shell.boardDepth;
      if (depthDelta !== 2) fail("the board moved " + depthDelta + " levels, expected exactly 2 fewer");
      else pass("the board sits exactly 2 levels higher (" + base.board.shell.boardDepth + " -> " + signature.board.shell.boardDepth + ")");

      const padX = base.board.shell.contentPadX;
      const padY = base.board.shell.wrapperPadY;
      const bw = signature.board.shell.boardRect.w - base.board.shell.boardRect.w;
      const by = base.board.shell.boardRect.y - signature.board.shell.boardRect.y;
      info("board rect: baseline " + JSON.stringify(base.board.shell.boardRect) + " -> current " + JSON.stringify(signature.board.shell.boardRect) + "; wrapper padding x=" + padX + " y=" + padY);
      if (bw !== padX) fail("the board width changed by " + bw + "px, expected the " + padX + "px the CardContent padded it by");
      else pass("the board grew exactly the CardContent's " + padX + "px of horizontal padding");
      if (by !== padY) fail("the board's top moved " + by + "px, expected the " + padY + "px of vertical padding above it");
      else pass("the board's top moved up exactly the " + padY + "px the wrappers padded above it");
      if (base.board.shell.rootRect.x !== signature.board.shell.rootRect.x || base.board.shell.rootRect.w !== signature.board.shell.rootRect.w) {
        fail("the page root moved: " + JSON.stringify(base.board.shell.rootRect) + " -> " + JSON.stringify(signature.board.shell.rootRect));
      } else pass("the page root kept its position and width (" + JSON.stringify(signature.board.shell.rootRect) + ")");
    }

    const noisy = [...hostBrowser.consoleEntries, ...guestBrowser.consoleEntries, ...watcherBrowser.consoleEntries].filter(
      (entry) => !/Nuxt DevTools|Suspense|\\[vite\\]|favicon|Download the Vue Devtools/.test(entry),
    );
    if (noisy.length > 0) fail("console was not clean: " + JSON.stringify(noisy.slice(0, 8), null, 2));
    else pass("console clean on all three pages (no errors, warnings, or exceptions)");
  } finally {
    hostBrowser.close();
    guestBrowser.close();
    watcherBrowser.close();
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
  console.error("\n" + failures.length + " check(s) failed");
  if (!KEEP) process.exitCode = 1;
} else {
  console.log("\nall game-page unwrap proof checks passed");
}
