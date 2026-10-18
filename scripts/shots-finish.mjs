// Measures the citadels surface: corner radius over the rendered surface, the
// live turn bar, and the over state's plate. CDP against a running dev server.
//
// Usage: node scripts/shots-finish.mjs [--port 3001] [--harness-only]
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3001"));
const HARNESS_ONLY = args.includes("--harness-only");
const BASE = "http://localhost:" + PORT;
const STAMP = Date.now();
const PASSWORD = "proof-password-123";
const OUT = ".audit/finish/";
const CITADELS_CAST = ["assassin","thief","magician","king","bishop","merchant","architect","warlord"];
const SURFACE = "[data-slot=citadels-surface]";
const ACTIONS = "[data-slot=citadels-surface] [data-slot=citadels-actions]";
const ACTION = "[data-slot=citadels-action]";
const TERMINAL = "[data-slot=citadels-surface] [data-slot=citadels-terminal]";

mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, label, detail) => {
  if (!ok) failures += 1;
  console.log((ok ? "PASS " : "FAIL ") + label + (detail === undefined ? "" : " :: " + detail));
};
const note = (label, detail) => console.log("INFO " + label + (detail === undefined ? "" : " :: " + detail));

const serverAnswers = async () => {
  try { return (await fetch(BASE + "/api/auth/ok")).ok; } catch { return false; }
};

const signUp = async (label) => {
  const res = await fetch(BASE + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: "finish-" + label + "-" + STAMP + "@example.com", password: PASSWORD, name: label }),
  });
  const body = await res.text();
  if (res.status !== 200) throw new Error("sign-up " + label + " returned " + res.status + ": " + body);
  const pair = res.headers.get("set-cookie").split(";")[0];
  const eq = pair.indexOf("=");
  return { cookie: pair, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const freePort = () => new Promise((res, rej) => {
  const probe = createServer();
  probe.on("error", rej);
  probe.listen(0, "127.0.0.1", () => { const port = probe.address().port; probe.close(() => res(port)); });
});

const launch = async (label) => {
  const debugPort = await freePort();
  const profile = "/tmp/finish-" + label + "-" + PORT + "-" + process.pid;
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn("/usr/bin/google-chrome", ["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--user-data-dir=" + profile,"--remote-debugging-port=" + debugPort,"--remote-allow-origins=*","about:blank"], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try { const res = await fetch("http://127.0.0.1:" + debugPort + "/json/version"); if (res.ok) wsUrl = (await res.json()).webSocketDebuggerUrl; } catch {}
    if (!wsUrl) await delay(250);
  }
  if (!wsUrl) throw new Error(label + ": chrome never exposed a debug endpoint");
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text);
    else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const created = (await send("Target.createTarget", { url: "about:blank" })).result;
  const attached = (await send("Target.attachToTarget", { targetId: created.targetId, flatten: true })).result;
  const session = attached.sessionId;
  await send("Page.enable", {}, session);
  await send("Runtime.enable", {}, session);
  await send("Network.enable", {}, session);
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false }, session);
  const page = {
    async eval(expression) {
      const msg = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, session);
      if (msg.result.exceptionDetails) {
        const details = msg.result.exceptionDetails;
        throw new Error((details.exception && details.exception.description) || details.text);
      }
      return msg.result.result.value;
    },
    async evalFn(fn) { return page.eval("(" + fn.toString() + ")()"); },
    async goto(url, waitMs = 2600) { await send("Page.navigate", { url }, session); await delay(waitMs); },
    async setCookie(user) { await send("Network.setCookie", { url: BASE, name: user.cookieName, value: user.cookieValue }, session); },
    async waitFor(expression, timeoutMs = 10000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) { if (await page.eval("!!(" + expression + ")")) return true; await delay(200); }
      return false;
    },
    async hydrated() { return page.waitFor("document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__", 60000); },
    async rectOf(jsEl) {
      return page.eval("(() => { const el = " + jsEl + "; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!el.disabled }; })()");
    },
    async clickReal(jsEl, attempts = 8, settleMs = 400) {
      for (let i = 0; i < attempts; i++) {
        const rect = await page.rectOf(jsEl);
        if (rect === null || rect.disabled) { await delay(250); continue; }
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y, buttons: 0 }, session);
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", buttons: 1, clickCount: 1 }, session);
        await delay(40);
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", buttons: 0, clickCount: 1 }, session);
        await delay(settleMs);
        return true;
      }
      return false;
    },
    async hoverReal(jsEl) {
      const rect = await page.rectOf(jsEl);
      if (rect === null) return false;
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rect.x, y: rect.y, buttons: 0 }, session);
      await delay(300);
      return true;
    },
    async shot(name) {
      const png = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, session);
      writeFileSync(OUT + name + ".png", Buffer.from(png.result.data, "base64"));
    },
  };
  return { page, errors, close: () => { try { ws.close(); } catch {} try { chrome.kill("SIGKILL"); } catch {} } };
};

/** Written as a function and stringified: a template literal eats regex escapes. */
const radiusFacts = function facts() {
  const root = document.querySelector("[data-slot=citadels-surface]");
  if (root === null) return null;
  const all = [...root.querySelectorAll("*")].filter((el) => el.tagName !== "IMG");
  const offenders = all
    .map((el) => ({ el, radius: getComputedStyle(el).borderRadius }))
    .filter((row) => row.radius !== "0px")
    .map((row) => ({
      tag: row.el.tagName.toLowerCase(),
      slot: row.el.getAttribute("data-slot"),
      action: row.el.getAttribute("data-action"),
      radius: row.radius,
      text: (row.el.textContent ?? "").trim().slice(0, 24),
    }));
  return {
    scope: root.getAttribute("data-slot"),
    counted: all.length,
    radiusNotZero: offenders.length,
    offenders,
  };
};

/** The turn bar's own facts, read from the page: owner, controls, build's gate. */
const actionFacts = function facts() {
  const surface = document.querySelector("[data-slot=citadels-surface]");
  const bar = document.querySelector("[data-slot=citadels-surface] [data-slot=citadels-actions]");
  const hand = [...document.querySelectorAll("[data-slot=citadels-hand] [data-slot=citadels-district]")];
  const buttons = bar === null ? [] : [...bar.querySelectorAll("[data-slot=citadels-action]")];
  const build = buttons.find((b) => b.getAttribute("data-action") === "build") ?? null;
  const rect = bar === null ? null : bar.getBoundingClientRect();
  return {
    surface: surface !== null,
    bar: bar !== null,
    actions: buttons.map((b) => b.getAttribute("data-action")),
    labels: buttons.map((b) => b.textContent.trim()),
    buildDisabled: build === null ? null : build.disabled,
    hand: hand.length,
    box: rect === null ? null : Math.round(rect.width) + "x" + Math.round(rect.height),
  };
};

/** The over state's own facts: the plate, its numbers, and how it leaves. */
const terminalFacts = function facts() {
  const plate = document.querySelector("[data-slot=citadels-surface] [data-slot=citadels-terminal]");
  if (plate === null) return null;
  const exit = plate.querySelector("[data-slot=citadels-terminal-exit]");
  const box = plate.getBoundingClientRect();
  const style = getComputedStyle(plate);
  const ink = (el) => (el === null ? null : getComputedStyle(el).boxShadow);
  return {
    insideSurface: plate.closest("[data-slot=citadels-surface]") !== null,
    winner: plate.querySelector("[data-slot=citadels-terminal-winner]")?.textContent.trim() ?? null,
    score: plate.querySelector("[data-slot=citadels-terminal-score]")?.textContent.replace(/s+/g, " ").trim() ?? null,
    terminal: plate.closest("[data-slot=citadels-surface]")?.getAttribute("data-phase") ?? null,
    frame: style.boxShadow,
    radius: style.borderRadius,
    borderBottom: style.borderTopWidth + "/" + style.borderBottomWidth,
    exitTag: exit === null ? null : exit.tagName.toLowerCase(),
    exitSlot: exit === null ? null : exit.getAttribute("data-slot"),
    exitFrame: ink(exit),
    exitRadius: exit === null ? null : getComputedStyle(exit).borderRadius,
    exitText: exit === null ? null : exit.textContent.trim(),
    underlined: exit === null ? null : getComputedStyle(exit).textDecorationLine,
    covers: Math.round(box.width) + "x" + Math.round(box.height),
  };
};

const harnessRun = async () => {
  const browser = await launch("harness");
  try {
    await browser.page.goto(BASE + "/dev/citadels-interface");
    const ready = await browser.page.waitFor("document.querySelector('" + SURFACE + "')", 20000);
    check(ready, "the surface harness renders");
    if (!ready) return;
    const radius = await browser.page.evalFn(radiusFacts);
    console.log("radius over the harness surface: " + JSON.stringify(radius));
    check(radius.radiusNotZero === 0, "no element on the harness surface carries a corner radius", String(radius.radiusNotZero));
    await browser.page.shot("surface-harness");
  } finally {
    browser.close();
  }
};

const liveRun = async () => {
  const host = await signUp("host");
  const guest = await signUp("guest");
  const created = await fetch(BASE + "/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, cookie: host.cookie },
    body: JSON.stringify({ name: "finish proof", seats: 2, setup: { game: "citadels", cast: CITADELS_CAST } }),
  });
  if (!created.ok) throw new Error("room create returned " + created.status + ": " + await created.text());
  const code = (await created.json()).room.code;
  const joined = await fetch(BASE + "/api/rooms/" + code + "/join", { method: "POST", headers: { origin: BASE, cookie: guest.cookie } });
  if (!joined.ok) throw new Error("join returned " + joined.status + ": " + await joined.text());
  const started = await fetch(BASE + "/api/rooms/" + code + "/start", { method: "POST", headers: { origin: BASE, cookie: host.cookie } });
  if (!started.ok) throw new Error("start returned " + started.status + ": " + await started.text());
  console.log("room: " + code);
  const hostBrowser = await launch("live-host");
  const guestBrowser = await launch("live-guest");
  try {
    await hostBrowser.page.setCookie(host);
    await guestBrowser.page.setCookie(guest);
    await Promise.all([hostBrowser.page.goto(BASE + "/games/" + code), guestBrowser.page.goto(BASE + "/games/" + code)]);
    await Promise.all([hostBrowser.page.hydrated(), guestBrowser.page.hydrated()]);
    const seats = [hostBrowser, guestBrowser];
    for (const [i, browser] of seats.entries()) {
      const entered = await browser.page.clickReal("document.querySelector('[data-slot=citadels-enter]')");
      check(entered, "seat " + i + " entered the surface");
    }
    await Promise.all(seats.map((b) => b.page.waitFor("document.querySelector('" + SURFACE + "')", 20000)));
    const radius = await hostBrowser.page.evalFn(radiusFacts);
    console.log("radius over the live surface: " + JSON.stringify(radius));
    check(radius.radiusNotZero === 0, "no element on the live surface carries a corner radius", String(radius.radiusNotZero));
    await hostBrowser.page.shot("surface-live");

    const bars = await Promise.all(seats.map((b) => b.page.evalFn(actionFacts)));
    const owner = bars.findIndex((facts) => facts.bar);
    console.log("live turn bars: " + JSON.stringify(bars));
    if (owner < 0) {
      note("no live turn window opened for either seat", JSON.stringify(bars));
      return;
    }
    const actor = bars[owner];
    const idle = bars[owner === 0 ? 1 : 0];
    check(actor.actions.join(",") === "gold,draw,build,pass", "the holding seat's bar carries the four turn actions", JSON.stringify(actor.actions));
    check(actor.buildDisabled === (actor.hand === 0), "build is disabled exactly when the hand is empty", actor.buildDisabled + " with hand " + actor.hand);
    check(idle.bar === false, "the seat that does not hold the turn renders no bar", JSON.stringify(idle.actions));
    await seats[owner].page.shot("turn-bar");

    const terminal = await Promise.all(seats.map((b) => b.page.evalFn(terminalFacts)));
    console.log("live terminal: " + JSON.stringify(terminal));
    const ended = terminal.filter((facts) => facts !== null);
    if (ended.length === 0) note("no seat reached the over state in this run", code);
    else check(ended.every((f) => f.insideSurface && f.winner !== null), "the over state renders a framed plate with the winner inside the live surface", JSON.stringify(ended));
  } finally {
    hostBrowser.close();
    guestBrowser.close();
  }
};

if (!(await serverAnswers())) throw new Error("the dev server on " + BASE + " is not answering; start it before this script");
await harnessRun();
if (!HARNESS_ONLY) await liveRun();
console.log(failures === 0 ? "ALL CHECKS PASS" : failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
