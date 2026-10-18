// Proves the keep-a-card surface: the CDP harness run asserts the drawn pair, the
// pool index each card reports, the non-opaque overlay, and that Escape leaves the
// window untouched; the live run reaches the real /games/<code> surface and
// asserts the same surface inside its root.
//
// Usage: node scripts/shots-keep.mjs [--port 3000] [--harness-only]
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3000"));
const HARNESS_ONLY = args.includes("--harness-only");
const BASE = "http://localhost:" + PORT;
const STAMP = Date.now();
const PASSWORD = "proof-password-123";
const OUT = ".audit/keep/";
const CITADELS_CAST = ["assassin","thief","magician","king","bishop","merchant","architect","warlord"];

mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, label, detail) => {
  if (!ok) failures += 1;
  console.log((ok ? "PASS " : "FAIL ") + label + (detail === undefined ? "" : " :: " + detail));
};

const serverAnswers = async () => {
  try { return (await fetch(BASE + "/api/auth/ok")).ok; } catch { return false; }
};

const signUp = async (label) => {
  const res = await fetch(BASE + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: `keep-${label}-${STAMP}@example.com`, password: PASSWORD, name: label }),
  });
  const body = await res.text();
  if (res.status !== 200) throw new Error(`sign-up ${label} returned ${res.status}: ${body}`);
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
  const profile = `/tmp/keep-${label}-${PORT}-${process.pid}`;
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn("/usr/bin/google-chrome", ["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,"--remote-allow-origins=*","about:blank"], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try { const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`); if (res.ok) wsUrl = (await res.json()).webSocketDebuggerUrl; } catch {}
    if (!wsUrl) await delay(250);
  }
  if (!wsUrl) throw new Error(`${label}: chrome never exposed a debug endpoint`);
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
    async goto(url, waitMs = 2600) { await send("Page.navigate", { url }, session); await delay(waitMs); },
    async setCookie(user) { await send("Network.setCookie", { url: BASE, name: user.cookieName, value: user.cookieValue }, session); },
    async waitFor(expression, timeoutMs = 10000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) { if (await page.eval(`!!(${expression})`)) return true; await delay(200); }
      return false;
    },
    async hydrated() {
      return page.waitFor("document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__", 60000);
    },
    async rectOf(jsEl) {
      return page.eval(`(() => { const el = ${jsEl}; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!el.disabled }; })()`);
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
    async shot(name) {
      const png = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, session);
      writeFileSync(OUT + name + ".png", Buffer.from(png.result.data, "base64"));
    },
    async press(key, code, keyCode) {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, session);
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, session);
    },
  };
  return { page, errors, close: () => { try { ws.close(); } catch {} try { chrome.kill("SIGKILL"); } catch {} } };
};

const KEEP = "[data-slot=citadels-keep]";
const KEEP_CARD = "[data-slot=citadels-keep-card]";
const SURFACE = "[data-slot=citadels-surface]";

const keepFacts = `(() => {
  const keep = document.querySelector('${KEEP}');
  if (keep === null) return null;
  const cards = [...keep.querySelectorAll('${KEEP_CARD}')];
  const box = keep.getBoundingClientRect();
  const parent = keep.parentElement.getBoundingClientRect();
  const style = getComputedStyle(keep);
  const rgba = style.backgroundColor;
  const inner = rgba.slice(rgba.lastIndexOf('(') + 1, rgba.length - 1).replace('/', ',');
  const alpha = Number(inner.split(',').pop().trim());
  return {
    insideSurface: keep.closest('${SURFACE}') !== null,
    cards: cards.length,
    index: cards.map((c) => c.getAttribute('data-index')),
    district: cards.map((c) => c.getAttribute('data-district')),
    names: [...keep.querySelectorAll('[data-slot=citadels-district] .citadels-district-name')].map((n) => ({
      text: n.textContent.trim(),
      wrap: getComputedStyle(n).overflowWrap,
      clipped: n.scrollWidth > n.clientWidth + 1,
    })),
    covers: Math.round(box.width) + 'x' + Math.round(box.height),
    parent: Math.round(parent.width) + 'x' + Math.round(parent.height),
    inset: Math.round(box.left - parent.left) + ',' + Math.round(box.top - parent.top),
    opaque: Number.isFinite(alpha) && alpha >= 0.99,
    background: style.backgroundColor,
    blur: style.backdropFilter,
  };
})()`;

const harnessRun = async () => {
  const browser = await launch("harness");
  try {
    await browser.page.goto(BASE + "/dev/keep-demo");
    const ready = await browser.page.waitFor(`document.querySelector('${KEEP_CARD}')`, 20000);
    check(ready, "the harness renders the keep surface");
    if (!ready) return;

    const window0 = await browser.page.eval(keepFacts);
    console.log("keep: " + JSON.stringify(window0));
    check(window0.cards === 2, "exactly two keep cards render", String(window0.cards));
    check(JSON.stringify(window0.index) === JSON.stringify(["0", "1"]), "the cards carry the pool indexes the reducer reads", JSON.stringify(window0.index));
    check(window0.district.every((id) => typeof id === "string" && id.length > 0), "each card names the district it offers", JSON.stringify(window0.district));
    check(window0.inset === "0,0" && window0.covers === window0.parent, "the surface covers the column it overlays", window0.inset + " " + window0.covers);
    check(!window0.opaque, "the overlay is tinted, not opaque", window0.background);
    check(window0.blur === "blur(2px)", "the overlay blurs the board behind it", window0.blur);
    check(window0.names.length === 2 && window0.names.every((n) => n.wrap === "anywhere" && !n.clipped), "the card names wrap and never truncate", JSON.stringify(window0.names));
    await browser.page.shot("keep-window");

    await browser.page.press("Escape", "Escape", 27);
    await delay(400);
    const escaped = await browser.page.eval(`(() => ({ keep: !!document.querySelector('${KEEP}'), log: document.querySelector('[data-slot=keep-demo-log]')?.textContent.trim() }))()`);
    check(escaped.keep && escaped.log === "keep none", "Escape leaves the window untouched", JSON.stringify(escaped));
    await browser.page.shot("keep-after-escape");

    const clicked = await browser.page.clickReal(`document.querySelector('${KEEP_CARD}[data-index="1"]')`);
    check(clicked, "the second card takes a click");
    const after = await browser.page.eval(`(() => ({ keep: !!document.querySelector('${KEEP}'), log: document.querySelector('[data-slot=keep-demo-log]')?.textContent.trim() }))()`);
    check(after.log === "keep 1", "clicking the second card reports keep index 1", JSON.stringify(after));
    await browser.page.shot("keep-after-click");
    check(browser.errors.length === 0, "the page logs no console error", JSON.stringify(browser.errors.slice(0, 3)));
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
    body: JSON.stringify({ name: "keep proof", seats: 2, setup: { game: "citadels", cast: CITADELS_CAST } }),
  });
  if (!created.ok) throw new Error(`room create returned ${created.status}: ${await created.text()}`);
  const code = (await created.json()).room.code;
  const joined = await fetch(`${BASE}/api/rooms/${code}/join`, { method: "POST", headers: { origin: BASE, cookie: guest.cookie } });
  if (!joined.ok) throw new Error(`join returned ${joined.status}: ${await joined.text()}`);
  const started = await fetch(`${BASE}/api/rooms/${code}/start`, { method: "POST", headers: { origin: BASE, cookie: host.cookie } });
  if (!started.ok) throw new Error(`start returned ${started.status}: ${await started.text()}`);
  console.log("room: " + code);

  const hostBrowser = await launch("live-host");
  const guestBrowser = await launch("live-guest");
  const seats = [
    { label: "host", browser: hostBrowser, user: host },
    { label: "guest", browser: guestBrowser, user: guest },
  ];
  const bodyOf = async (browser) =>
    browser.page.eval("document.body.innerText.split(String.fromCharCode(10)).join(\" | \").slice(0, 240)");

  const enter = async ({ label, browser }) => {
    const clicked = await browser.page.clickReal("document.querySelector('[data-slot=citadels-enter]')");
    if (!clicked) throw new Error(`${label}: the gate never offered Enter`);
    const up = await browser.page.waitFor(`document.querySelector('[data-slot=citadels-surface]')`, 20000);
    if (!up) throw new Error(`${label}: the surface never came up`);
  };

  const pageState = async (browser) =>
    browser.page.eval(
      "(() => ({ picker: document.querySelector('[data-slot=citadels-picker]') !== null, turn: document.querySelector('[data-slot=citadels-actions]') !== null }))()",
    );

  try {
    for (const seat of seats) await seat.browser.page.setCookie(seat.user);
    await Promise.all(seats.map(({ browser }) => browser.page.goto(`${BASE}/games/${code}`)));
    await Promise.all(seats.map(({ browser }) => browser.page.hydrated()));
    for (const seat of seats) await enter(seat);
    check(true, "both seats reached the live surface", code);

    const picks = { host: 0, guest: 0 };
    let actor = null;
    let idle = 0;
    for (let i = 0; i < 900 && actor === null; i += 1) {
      let moved = false;
      for (const seat of seats) {
        const state = await pageState(seat.browser);
        if (state.turn) { actor = seat; break; }
        if (!state.picker) continue;
        const card = await seat.browser.page.clickReal("document.querySelector('[data-slot=citadels-picker-card]:not([disabled])')");
        if (!card) throw new Error(`${seat.label}: no pickable character card`);
        const confirmed = await seat.browser.page.clickReal("document.querySelector('[data-slot=citadels-picker-confirm]')");
        if (!confirmed) throw new Error(`${seat.label}: the pick dialog offered no confirm`);
        picks[seat.label] += 1;
        moved = true;
      }
      if (moved) { idle = 0; continue; }
      idle += 1;
      if (idle % 25 === 0) console.log(`waiting: picks ${JSON.stringify(picks)} idle ${idle} · host ${await hostBrowser.page.eval("document.querySelector('[data-slot=citadels-phase]')?.textContent.trim()")}`);
      if (idle > 300) break;
      await delay(400);
    }
    check(picks.host > 0 && picks.guest > 0, "both seats drafted on the live surface", JSON.stringify(picks));
    if (actor === null) throw new Error(`no seat reached a turn window; host body: ${await bodyOf(hostBrowser)}`);
    check(true, `the turn window opened for the ${actor.label}`, `${code} after picks ${JSON.stringify(picks)}`);
    await actor.browser.page.shot("keep-live-turn");

    const handBefore = await actor.browser.page.eval("document.querySelectorAll('[data-slot=citadels-hand] [data-slot=citadels-district]').length");
    const drew = await actor.browser.page.clickReal("document.querySelector('[data-slot=citadels-action][data-action=\"draw\"]')");
    check(drew, "the turn window offers the draw action");

    const opened = await actor.browser.page.waitFor(`document.querySelector('[data-slot=citadels-keep]')`, 15000);
    if (!opened) {
      check(false, "the keep surface opens on the live board after the draw", await bodyOf(actor.browser));
      return;
    }

    const live = await actor.browser.page.eval(keepFacts);
    console.log("live keep: " + JSON.stringify(live));
    check(live.insideSurface, "the keep surface renders inside the live surface root");
    check(live.cards === 2, "the live keep offers the two drawn cards", String(live.cards));
    check(JSON.stringify(live.index) === JSON.stringify(["0", "1"]), "the live cards carry indexes 0 and 1", JSON.stringify(live.index));
    check(live.district.every((id) => typeof id === "string" && id.length > 0), "each live card names a real district", JSON.stringify(live.district));
    check(!live.opaque && live.blur === "blur(2px)", "the live overlay stays tinted and blurred", live.background + " " + live.blur);
    check(live.names.length === 2 && live.names.every((n) => n.wrap === "anywhere" && !n.clipped), "the live card names wrap and never truncate", JSON.stringify(live.names));
    await actor.browser.page.shot("keep-live-window");

    const kept = await actor.browser.page.clickReal(`document.querySelector('[data-slot=citadels-keep-card][data-index="1"]')`);
    check(kept, "the second live card takes a click");
    const gone = await actor.browser.page.waitFor("document.querySelector('[data-slot=citadels-keep]') === null", 15000);
    check(gone, "keeping a card closes the live window");
    const handAfter = await actor.browser.page.eval("document.querySelectorAll('[data-slot=citadels-hand] [data-slot=citadels-district]').length");
    check(handAfter === handBefore + 1, "the kept card joins the hand", handBefore + " -> " + handAfter);
    await actor.browser.page.shot("keep-live-kept");
  } finally {
    for (const { browser } of seats) browser.close();
  }
};

if (!(await serverAnswers())) throw new Error("the dev server on " + BASE + " is not answering; start it before this script");
await harnessRun();
if (!HARNESS_ONLY) {
  try {
    await liveRun();
  } catch (error) {
    check(false, "the live surface run completed", String(error.message ?? error));
  }
}
console.log(failures === 0 ? "ALL CHECKS PASS" : failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
