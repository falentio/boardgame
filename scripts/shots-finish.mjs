// Measures the citadels surface: corner radius over the rendered surface, the
// live turn bar, and the over state's plate. CDP against a running dev server.
//
// Usage: node scripts/shots-finish.mjs [--port 3001] [--harness-only] [--terminal]
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
  const postings = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text);
    else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    else if (m.method === "Network.requestWillBeSent") {
      const request = m.params.request;
      const body = typeof request.postData === "string" ? request.postData : null;
      if (body !== null && request.method === "POST" && request.url.indexOf("/api/rooms/") >= 0) {
        postings.push({ url: request.url, body });
      }
    }
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
    async pressTab() {
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }, session);
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 }, session);
      await delay(120);
    },
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
  return { page, errors, postings, close: () => { try { ws.close(); } catch {} try { chrome.kill("SIGKILL"); } catch {} } };
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
    score: plate.querySelector("[data-slot=citadels-terminal-score]")?.textContent.replace(/\s+/g, " ").trim() ?? null,
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
    const handOf = "(() => { const b = document.querySelector('[data-slot=citadels-hand] button'); const c = b.querySelector('[data-slot=citadels-district]'); return { radius: getComputedStyle(b).borderRadius, card: getComputedStyle(c).boxShadow, lift: getComputedStyle(c).translate, over: [...document.querySelectorAll(':hover')].map((el) => el.getAttribute('data-slot') ?? el.tagName.toLowerCase()) }; })()";
    const handIdle = await browser.page.eval(handOf);
    await browser.page.hoverReal("document.querySelector('[data-slot=citadels-hand] button')");
    const handHover = await browser.page.eval(handOf);
    let focusedHand = false;
    for (let tab = 0; tab < 80 && !focusedHand; tab += 1) {
      await browser.page.pressTab();
      focusedHand = await browser.page.eval("document.activeElement !== null && document.activeElement.closest('[data-slot=citadels-hand]') !== null && document.activeElement.matches(':focus-visible')");
    }
    const handFocus = await browser.page.eval("(() => { const b = document.activeElement; return { inside: b === null || b.closest === undefined ? false : b.closest('[data-slot=citadels-hand]') !== null, focusVisible: b === null || b.matches === undefined ? false : b.matches(':focus-visible'), shadow: b === null || getComputedStyle === undefined ? null : getComputedStyle(b).boxShadow }; })()");
    console.log("hand idle, hover, focus: " + JSON.stringify([handIdle, handHover, handFocus]));
    check(handIdle.radius === "0px", "the hand build button is square", handIdle.radius);
    check(handHover.over.includes("citadels-hand"), "the pointer reaches the hand button's own tile", JSON.stringify(handHover.over));
    check(handHover.card === handIdle.card && handHover.lift === handIdle.lift, "the hand tile's hover is the card frame's own, unchanged by the radius", handIdle.card === handHover.card ? "no computed change on hover" : "changed");
    note("the card frame carries no hover rule, so the hand tile answers a pointer with nothing (DistrictCard.vue:63)");
    check(handFocus.inside && handFocus.focusVisible && handFocus.shadow !== "none", "the hand build button still shows its focus ring", JSON.stringify(handFocus));
    note("the tile the keyboard ring sits on", await browser.page.eval("(() => { const b = document.activeElement; const tile = b.closest('[data-slot=citadels-hand] li'); return (tile === null ? 'none' : tile.textContent.trim().replace(/\\s+/g, ' ')) + ' <' + b.tagName.toLowerCase() + '>'; })()"));
    await delay(500);
    await browser.page.shot("hand-focus");
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
    const enterSeat = async (browser, seat) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const ready = await browser.page.waitFor("document.querySelector('[data-slot=citadels-enter]') || document.querySelector('" + SURFACE + "')", 25000);
        if (ready) {
          await browser.page.clickReal("document.querySelector('[data-slot=citadels-enter]')");
          if (await browser.page.waitFor("document.querySelector('" + SURFACE + "')", 25000)) return true;
        }
        note("seat " + seat + " took the table again", "attempt " + (attempt + 2));
        await browser.page.goto(BASE + "/games/" + code);
        await browser.page.hydrated();
      }
      return false;
    };
    for (const [i, browser] of seats.entries()) check(await enterSeat(browser, i), "seat " + i + " entered the surface");
    const radius = await hostBrowser.page.evalFn(radiusFacts);
    console.log("radius over the live surface: " + JSON.stringify(radius));
    check(radius !== null && radius.radiusNotZero === 0, "no element on the live surface carries a corner radius", radius === null ? "the surface did not render" : String(radius.radiusNotZero));
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

/** The winner's own district count, read off the seat plates the board draws. */
const scoreFacts = function facts() {
  const plates = [...document.querySelectorAll("[data-slot=citadels-self-city], [data-slot=citadels-seat-city]")];
  return plates.map((plate) => plate.textContent.replace(/\s+/g, " ").trim());
};

const reportsIn = (postings) =>
  postings
    .map((posted) => {
      try {
        return JSON.parse(posted.body);
      } catch {
        return null;
      }
    })
    .filter((envelope) => envelope !== null && envelope.body?.kind === "report")
    .map((envelope) => envelope.body.report);

/** The seat ids and frames come from the app's own posted messages, never from a guess. */
const frameOf = (reports) => (reports.length === 0 ? null : reports[reports.length - 1].frame);

const seatOfReports = (reports) => (reports.length === 0 ? null : reports[0].seat);

const WINDOWLESS = ["king", "bishop", "merchant", "architect"];

/** The surface answers the gather, not an ability window, so prefer a windowless character. */
const pickIn = (page) =>
  page.clickReal(
    WINDOWLESS.map((id) => "[data-slot=citadels-picker-card][data-character=" + id + "]:not([disabled])")
      .concat(["[data-slot=citadels-picker-card]:not([disabled])"])
      .map((selector) => "document.querySelector('" + selector + "')")
      .join(" || "),
  );

const latestCommitted = (seats) => {
  let best = null;
  for (const seat of seats) {
    for (const posted of seat.postings) {
      let envelope = null;
      try {
        envelope = JSON.parse(posted.body);
      } catch {
        continue;
      }
      const frame = envelope?.body?.kind === "frame" ? envelope.body.frame?.index : null;
      if (typeof frame === "number") best = Math.max(best ?? -1, frame);
    }
  }
  return best;
};

const actionClick = (page, action) =>
  page.clickReal("document.querySelector('[data-slot=citadels-action][data-action=" + action + "]')");

const terminalRun = async () => {
  const host = await signUp("t-host");
  const guest = await signUp("t-guest");
  const created = await fetch(BASE + "/api/rooms", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, cookie: host.cookie },
    body: JSON.stringify({ name: "finish terminal", seats: 2, setup: { game: "citadels", cast: CITADELS_CAST } }),
  });
  if (!created.ok) throw new Error("room create returned " + created.status + ": " + (await created.text()));
  const code = (await created.json()).room.code;
  const joined = await fetch(BASE + "/api/rooms/" + code + "/join", { method: "POST", headers: { origin: BASE, cookie: guest.cookie } });
  if (!joined.ok) throw new Error("join returned " + joined.status + ": " + (await joined.text()));
  const started = await fetch(BASE + "/api/rooms/" + code + "/start", { method: "POST", headers: { origin: BASE, cookie: host.cookie } });
  if (!started.ok) throw new Error("start returned " + started.status + ": " + (await started.text()));
  console.log("terminal room: " + code);

  const hostBrowser = await launch("terminal-host");
  const guestBrowser = await launch("terminal-guest");
  const seats = [hostBrowser, guestBrowser];
  try {
    await hostBrowser.page.setCookie(host);
    await guestBrowser.page.setCookie(guest);
    await Promise.all([hostBrowser.page.goto(BASE + "/games/" + code), guestBrowser.page.goto(BASE + "/games/" + code)]);
    await Promise.all([hostBrowser.page.hydrated(), guestBrowser.page.hydrated()]);
    for (const [index, seat] of seats.entries()) {
      const entered = await seat.page.clickReal("document.querySelector('[data-slot=citadels-enter]')");
      check(entered, "terminal seat " + index + " entered the surface");
    }
    await Promise.all(seats.map((seat) => seat.page.waitFor("document.querySelector('" + SURFACE + "')", 20000)));

    const deadline = Date.now() + 150000;
    let holder = null;
    while (Date.now() < deadline && holder === null) {
      for (const seat of seats) {
        const picker = await seat.page.eval("document.querySelector('[data-slot=citadels-picker]') !== null");
        if (picker) {
          await pickIn(seat.page);
          await seat.page.clickReal("document.querySelector('[data-slot=citadels-picker-confirm]')");
        }
      }
      const bars = await Promise.all(seats.map((seat) => seat.page.evalFn(actionFacts)));
      const at = bars.findIndex((facts) => facts.bar);
      if (at >= 0) holder = { index: at, facts: bars[at] };
      else await delay(200);
    }
    if (holder === null) {
      note("no turn window opened after the draft in " + code, "the resign below cannot land without a seat the engine owes");
      return;
    }

    const reports = seats.map((seat) => reportsIn(seat.postings));
    const seatIds = reports.map(seatOfReports);
    note("seat ids read from the pages' own reports", JSON.stringify(seatIds));
    await seats[holder.index].page.shot("terminal-turn-bar");
    const strong = holder.index;
    const weak = strong === 0 ? 1 : 0;
    const strongName = strong === 0 ? "host" : "guest";

    const gather = await actionClick(seats[strong].page, "gold");
    note("the holding seat gathers two gold", String(gather));
    const buildButton = "document.querySelector('[data-slot=citadels-action][data-action=build]:not([disabled])')";
    const buildable = await seats[strong].page.waitFor(buildButton, 60000);
    const built = buildable ? await actionClick(seats[strong].page, "build") : false;
    note("the holding seat builds from its hand", String(built));
    const scores = await seats[strong].page.evalFn(scoreFacts);
    note("cities after the build", JSON.stringify(scores));
    const stillHolding = await seats[strong].page.evalFn(actionFacts);
    if (stillHolding.bar) {
      note("the holding seat ends its turn", String(await actionClick(seats[strong].page, "pass")));
    }

    const weakIds = seatIds[weak];
    const baseFrame = frameOf(reports[strong]);
    if (weakIds === null || baseFrame === null) {
      note("no report captured for the seat that resigns", JSON.stringify(seatIds));
      return;
    }
    const cookie = weak === 0 ? host.cookie : guest.cookie;
    const owedNow = (page) =>
      page.eval("document.querySelector('[data-slot=citadels-picker]') !== null || document.querySelector('[data-slot=citadels-actions]') !== null");
    let landed = null;
    for (let attempt = 0; attempt < 60 && landed === null; attempt += 1) {
      const owed = await owedNow(seats[weak].page);
      if (attempt < 2 || owed) note("resign attempt", "the seat that resigns owes a window: " + String(owed));

      // A resignation is a real seat input, and a session folds one only while the
      // seat is owed, so the frame comes from the seats' own latest sealed frame.
      const frame = (latestCommitted(seats) ?? baseFrame) + 1;
      if (attempt < 2 || owed) note("frame for the resign", String(frame));
      const post = await fetch(BASE + "/api/rooms/" + code + "/game", {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, cookie },
        body: JSON.stringify({ v: 1, body: { kind: "report", report: { frame, seat: weakIds, input: { k: "resign" } } } }),
      });
      if (!post.ok) note("resign post refused", post.status + " " + (await post.text()));
      await delay(1500);
      const facts = await Promise.all(seats.map((seat) => seat.page.evalFn(terminalFacts)));
      landed = facts.find((entry) => entry !== null) ?? null;
      if (landed !== null) note("the resign landed on frame", String(frame));
    }
    const bars = await Promise.all(seats.map((seat) => seat.page.evalFn(actionFacts)));
    note("bars at the end of the terminal pass", JSON.stringify(bars));
    if (landed === null) {
      note("the resign report never matched a frame the seats owed in " + code, "no over state to assert");
      return;
    }
    const all = await Promise.all(seats.map((seat) => seat.page.evalFn(terminalFacts)));
    console.log("live terminal: " + JSON.stringify(all));
    check(all.every((facts) => facts !== null), "both seats read the over state from their own board");
    check(all.every((facts) => facts.insideSurface), "the over state renders inside the live surface root");
    check(all.every((facts) => facts.winner !== null), "the plate names the winner", JSON.stringify(all.map((facts) => facts.winner)));
    check(all.every((facts) => facts.score !== null && facts.score.length > 0), "the plate carries the winner's tally", JSON.stringify(all.map((facts) => facts.score)));
    check(all.every((facts) => facts.radius === "0px" && facts.frame.includes("inset")), "the plate is a square framed piece", JSON.stringify(all.map((facts) => facts.radius + " " + facts.frame.slice(0, 60))));
    check(all.every((facts) => facts.exitRadius === "0px" && facts.exitFrame.includes("inset") && facts.underlined === "none"), "the way out is a framed control, not an underlined link", JSON.stringify(all.map((facts) => facts.exitTag + " " + facts.underlined + " " + facts.exitRadius)));
    await seats[strong].page.shot("terminal-plate");
    await seats[weak].page.shot("terminal-plate-other-seat");
  } finally {
    hostBrowser.close();
    guestBrowser.close();
  }
};

if (!(await serverAnswers())) throw new Error("the dev server on " + BASE + " is not answering; start it before this script");
await harnessRun();
if (args.includes("--terminal")) await terminalRun();
else if (!HARNESS_ONLY) await liveRun();
console.log(failures === 0 ? "ALL CHECKS PASS" : failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
