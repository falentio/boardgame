// Proves the window-choice surface: the harness run asserts every panel renders its
// model's controls off a board folded from genesis; the live run asserts the same
// section inside the real /games/<code> surface root and that a tile resolves the
// window.
//
// Usage: node scripts/shots-choice.mjs [--port 3003] [--harness-only]
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3003"));
const HARNESS_ONLY = args.includes("--harness-only");
const BASE = process.env.CITADELS_BASE ?? "http://localhost:" + PORT;
const STAMP = Date.now();
const PASSWORD = "proof-password-123";
const OUT = ".audit/choice/";
const CHOICE_KINDS = ["seat", "character", "type", "district", "card", "confirm"];
const CITADELS_CAST = ["assassin", "thief", "magician", "king", "bishop", "merchant", "architect", "warlord"];

mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, label, detail) => {
  if (!ok) failures += 1;
  console.log((ok ? "PASS " : "FAIL ") + label + (detail === undefined ? "" : " :: " + detail));
};

const PROBE = "(() => {const P = \"[data-slot=choice-demo-panel]\", C = \"[data-slot=citadels-choice]\", O = \"[data-slot=citadels-choice-option]\";return [...document.querySelectorAll(P)].map((panel) => ({purpose: panel.getAttribute('data-purpose'), model: Number(panel.getAttribute('data-model-count')), frames: Number(panel.getAttribute('data-frames')),section: panel.querySelector(C) !== null, count: panel.querySelectorAll(O).length,kinds: [...new Set([...panel.querySelectorAll(O)].map((one) => one.getAttribute('data-choice-kind')))],values: [...panel.querySelectorAll(O)].map((one) => one.getAttribute('data-choice-value')),}));})()";
const CLICK = "(() => {const P = \"[data-slot=choice-demo-panel]\", O = \"[data-slot=citadels-choice-option]\", L = \"[data-slot=choice-demo-log]\";const panel = [...document.querySelectorAll(P)].find((one) => one.getAttribute('data-purpose') === 'choose-character');const option = panel.querySelector(O);const card = { label: option.querySelector('span').textContent.trim(), kind: option.getAttribute('data-choice-kind'), value: option.getAttribute('data-choice-value') };option.click();return new Promise((resolve) => setTimeout(() => resolve({ ...card, log: document.querySelector(L).textContent.trim() }), 150));})()";
const RECT = "(() => {const P = \"[data-slot=choice-demo-panel]\";const panel = [...document.querySelectorAll(P)].find((one) => one.getAttribute('data-purpose') === 'warlord-destroy');const box = panel.getBoundingClientRect(); return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };})()";
const LIVE_FACTS = "(() => {const S = \"[data-slot=citadels-surface]\", C = \"[data-slot=citadels-choice]\", O = \"[data-slot=citadels-choice-option]\";const surface = document.querySelector(S); const inside = surface === null ? null : surface.querySelector(C);const options = inside === null ? [] : [...inside.querySelectorAll(O)];return { surface: surface !== null, insideSurface: inside !== null, purpose: inside === null ? null : inside.getAttribute('data-choice-purpose'),count: options.length, kinds: [...new Set(options.map((one) => one.getAttribute('data-choice-kind')))].filter(Boolean),values: options.map((one) => one.getAttribute('data-choice-value')),labels: options.map((one) => one.textContent.trim()).slice(0, 8),framed: options.every((one) => getComputedStyle(one).borderRadius === '0px') };})()";

const signUp = async (label) => {
  const res = await fetch(BASE + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: `choice-${label}-${STAMP}@example.com`, password: PASSWORD, name: label }),
  });
  const body = await res.text();
  if (res.status !== 200) throw new Error(`sign-up ${label} returned ${res.status}: ${body}`);
  const pair = res.headers.get("set-cookie").split(";")[0];
  const eq = pair.indexOf("=");
  return { cookie: pair, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });

const launch = async (label) => {
  const debugPort = await freePort();
  const profile = `/tmp/choice-${label}-${PORT}-${process.pid}`;
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn("/usr/bin/google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", `--user-data-dir=${profile}`, `--remote-debugging-port=${debugPort}`, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (res.ok) wsUrl = (await res.json()).webSocketDebuggerUrl;
    } catch {}
    if (!wsUrl) await delay(250);
  }
  if (!wsUrl) throw new Error(`${label}: chrome never exposed a debug endpoint`);
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve) => { const next = ++id; pending.set(next, resolve); ws.send(JSON.stringify({ id: next, method, params, sessionId })); });
  const created = (await send("Target.createTarget", { url: "about:blank" })).result;
  const session = (await send("Target.attachToTarget", { targetId: created.targetId, flatten: true })).result.sessionId;
  await send("Page.enable", {}, session);
  await send("Runtime.enable", {}, session);
  await send("Network.enable", {}, session);
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false }, session);
  const page = {
    async eval(expression) {
      const message = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, session);
      if (message.result.exceptionDetails) {
        const details = message.result.exceptionDetails;
        throw new Error((details.exception && details.exception.description) || details.text);
      }
      return message.result.result.value;
    },
    async goto(url, waitMs = 2600) { await send("Page.navigate", { url }, session); await delay(waitMs); },
    async setCookie(user) { await send("Network.setCookie", { url: BASE, name: user.cookieName, value: user.cookieValue }, session); },
    async waitFor(expression, timeoutMs = 10000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) { if (await page.eval(`!!(${expression})`)) return true; await delay(200); }
      return false;
    },
    async hydrated() { return page.waitFor("document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__", 60000); },
    async rectOf(jsEl) {
      return page.eval(`(() => { const el = ${jsEl}; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!el.disabled }; })()`);
    },
    async clickReal(jsEl, attempts = 8, settleMs = 400) {
      for (let i = 0; i < attempts; i += 1) {
        const box = await page.rectOf(jsEl);
        if (box === null || box.disabled) { await delay(250); continue; }
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y, buttons: 0 }, session);
        await send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", buttons: 1, clickCount: 1 }, session);
        await delay(40);
        await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", buttons: 0, clickCount: 1 }, session);
        await delay(settleMs);
        return true;
      }
      return false;
    },
    async shot(path, full = false, clip) {
      const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, ...(full ? { captureBeyondViewport: true } : {}), ...(clip === undefined ? {} : { clip }) }, session);
      writeFileSync(path, Buffer.from(shot.result.data, "base64"));
    },
  };
  return { page, errors, close: () => { try { ws.close(); } catch {} try { chrome.kill("SIGKILL"); } catch {} } };
};

const harnessRun = async () => {
  const browser = await launch("harness");
  try {
    await browser.page.goto(BASE + "/dev/choice-demo", 1800);
    const panels = await browser.page.eval(PROBE);
    check(Array.isArray(panels) && panels.length === 6, "six panels folded from genesis render", String(Array.isArray(panels) ? panels.length : panels));
    for (const panel of panels) {
      const named = `${panel.purpose} (${panel.frames} frames)`;
      check(panel.section, "the choice section renders for " + named);
      check(panel.count === panel.model && panel.model > 0, "the controls match the model for " + named, `${panel.count}/${panel.model}`);
      check(panel.kinds.every((kind) => CHOICE_KINDS.includes(kind)), "every control carries a kind for " + named, panel.kinds.join(","));
      check(panel.values.every((value) => typeof value === "string" && value.length > 0), "every control carries a value for " + named, panel.values.join(","));
    }
    const kinds = new Set(panels.flatMap((panel) => panel.kinds));
    check(["seat", "character", "type", "district", "card"].every((kind) => kinds.has(kind)), "seat, character, type, district and card all render", [...kinds].join(","));
    const card = await browser.page.eval(CLICK);
    check(card.log.includes(card.value), "clicking a tile reports its own action", `clicked ${card.kind}/${card.label} -> ${card.log}`);
    await browser.page.shot(OUT + "panels.png", true);
    const box = await browser.page.eval(RECT);
    await browser.page.shot(OUT + "warlord.png", false, { ...box, scale: 2 });
    console.log("warlord-destroy panel: " + JSON.stringify(box));
    check(browser.errors.length === 0, "the harness page logs no console error", JSON.stringify(browser.errors.slice(0, 3)));
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
    body: JSON.stringify({ name: "choice proof", seats: 2, setup: { game: "citadels", cast: CITADELS_CAST } }),
  });
  if (!created.ok) throw new Error(`room create returned ${created.status}: ${await created.text()}`);
  const code = (await created.json()).room.code;
  const joined = await fetch(`${BASE}/api/rooms/${code}/join`, { method: "POST", headers: { origin: BASE, cookie: guest.cookie } });
  if (!joined.ok) throw new Error(`join returned ${joined.status}: ${await joined.text()}`);
  const started = await fetch(`${BASE}/api/rooms/${code}/start`, { method: "POST", headers: { origin: BASE, cookie: host.cookie } });
  if (!started.ok) throw new Error(`start returned ${started.status}: ${await started.text()}`);
  console.log("room: " + code);

  const seats = [
    { label: "host", browser: await launch("live-host"), user: host },
    { label: "guest", browser: await launch("live-guest"), user: guest },
  ];
  const choiceThere = "document.querySelector('[data-slot=citadels-surface] [data-slot=citadels-choice]') !== null";
  const pickerThere = "document.querySelector('[data-slot=citadels-picker-card]:not([disabled])') !== null";
  try {
    for (const seat of seats) await seat.browser.page.setCookie(seat.user);
    for (const seat of seats) await seat.browser.page.goto(`${BASE}/games/${code}`);
    for (const seat of seats) {
      if (!(await seat.browser.page.hydrated())) throw new Error(`${seat.label}: the page never hydrated`);
    }
    for (const seat of seats) {
      const entered = await seat.browser.page.clickReal("document.querySelector('[data-slot=citadels-enter]')");
      if (!entered) throw new Error(`${seat.label}: the gate never offered Enter`);
    }
    check(true, "both seats reached the live surface", code);

    const picks = { host: 0, guest: 0 };
    let actor = null;
    for (let i = 0; i < 900 && actor === null; i += 1) {
      for (const seat of seats) {
        if (await seat.browser.page.eval(choiceThere)) { actor = seat; break; }
      }
      if (actor !== null) break;
      let moved = false;
      for (const seat of seats) {
        if (!(await seat.browser.page.eval(pickerThere))) continue;
        const card = await seat.browser.page.clickReal("document.querySelector('[data-slot=citadels-picker-card]:not([disabled])')");
        if (!card) throw new Error(`${seat.label}: no pickable character card`);
        await seat.browser.page.clickReal("document.querySelector('[data-slot=citadels-picker-confirm]')");
        picks[seat.label] += 1;
        moved = true;
      }
      if (moved) continue;
      if (i % 25 === 0) console.log(`waiting: picks ${JSON.stringify(picks)} · host ${await seats[0].browser.page.eval("document.querySelector('[data-slot=citadels-phase]')?.textContent.trim()")}`);
      await delay(300);
    }
    check(picks.host > 0 && picks.guest > 0, "both seats drafted on the live surface", JSON.stringify(picks));
    if (actor === null) throw new Error("no seat reached a window with choices");

    const live = await actor.browser.page.eval(LIVE_FACTS);
    console.log("live choice: " + JSON.stringify(live));
    check(live.insideSurface, "the choice section renders inside the live surface root");
    check(live.count > 0, "the live window offers at least one control", String(live.count));
    check(live.kinds.every((kind) => CHOICE_KINDS.includes(kind)), "every live control carries a kind", live.kinds.join(","));
    check(live.values.every((value) => typeof value === "string" && value.length > 0), "every live control carries a value", live.values.join(","));
    check(live.framed, "the live tiles keep square corners");
    await actor.browser.page.shot(OUT + "live-window.png");

    if (["choose-character", "choose-seat", "choose-type"].includes(live.purpose)) {
      const other = seats.find((seat) => seat.label !== actor.label);
      const theirs = await other.browser.page.eval(LIVE_FACTS);
      check(!theirs.insideSurface, `the ${live.purpose} window offers nothing to the seat the resolver ignores`, String(theirs.count));
    }

    const picked = live.values[0];
    const clicked = await actor.browser.page.clickReal("document.querySelector('[data-slot=citadels-surface] [data-slot=citadels-choice-option]')");
    check(clicked, "the first live control takes a click", picked);
    const settled = await actor.browser.page.waitFor(
      `!(${choiceThere}) || document.querySelector('[data-slot=citadels-surface] [data-slot=citadels-choice]').getAttribute('data-choice-purpose') !== '${live.purpose}' || document.querySelectorAll('[data-slot=citadels-surface] [data-slot=citadels-choice-option]').length !== ${live.count}`,
      45000,
    );
    check(settled, "reporting the choice resolves the live window", `${live.purpose} ${live.count} -> reporting ${picked}`);
    await actor.browser.page.shot(OUT + "live-after.png");
    check(actor.browser.errors.length === 0, "the live surface logs no console error", JSON.stringify(actor.browser.errors.slice(0, 2)));
  } finally {
    for (const seat of seats) seat.browser.close();
  }
};

await harnessRun();
if (!HARNESS_ONLY) await liveRun();
console.log(failures === 0 ? "ALL CHECKS PASS" : failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
