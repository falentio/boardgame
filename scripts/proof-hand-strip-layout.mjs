// Live proof of the hand-strip layout for the window picker on the real
// /games/<code> surface: at ~900px the select strip scrolls horizontally and its
// cards share one height, a divider splits the general-action cards from the
// role-claim cards, a target role card opens a player-card strip, and Confirm
// still advances the turn.
//
// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth
// rejects the sign-up with INVALID_ORIGIN.
//
// Usage: node scripts/proof-hand-strip-layout.mjs [--port 3000] [--out DIR] [--keep]
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
const OUT = argOf("--out", new URL("../.audit/proof/", import.meta.url).pathname);
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
  const email = `strip-${label}-${STAMP}@example.com`;
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
  const profileDir = `/tmp/proof-strip-${label}-${PORT}-${process.pid}`;
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
    // A real CDP pointer sequence at the element's centre: reka-ui's Select and the
    // card buttons ignore a synthetic `el.click()`.
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
    async screenshot(name, { fullPage = false } = {}) {
      const params = { format: "png" };
      if (fullPage) params.captureBeyondViewport = true;
      const { result } = await send("Page.captureScreenshot", params, session);
      const path = `${OUT}${name}.png`;
      writeFileSync(path, Buffer.from(result.data, "base64"));
      return path;
    },
  };
  return { chrome, page, close: () => chrome.kill("SIGKILL") };
};

const EL = {
  picker: "[data-slot=window-picker]",
  roleCard: (name) => `[...document.querySelectorAll('[data-slot=window-picker] button[data-slot=role-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  generalCard: (name) => `[...document.querySelectorAll('[data-slot=window-picker] button[data-slot=general-action-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  playerCard: (name) => `[...document.querySelectorAll('[data-slot=player-card]')].find((b) => (b.getAttribute('aria-label') || '') === ${JSON.stringify(name)})`,
  confirm: `[...document.querySelectorAll('[data-slot=window-picker] button')].find((b) => b.textContent.trim() === 'Confirm')`,
  buttonText: (name) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(name)}))`,
};

const turnNumber = async (page) => {
  const text = await page.bodyText();
  const m = text.match(/turn\s+(\d+)/i);
  return m === null ? null : Number(m[1]);
};

const pickerState = (page) => page.eval(`(() => {
  const picker = document.querySelector('[data-slot=window-picker]');
  return {
    present: !!picker,
    title: picker?.querySelector('h2')?.textContent.trim() ?? null,
    roleCards: picker ? picker.querySelectorAll('[data-slot=role-card]').length : 0,
    generalCards: picker ? picker.querySelectorAll('[data-slot=general-action-card]').length : 0,
    playerCards: picker ? picker.querySelectorAll('[data-slot=player-card]').length : 0,
    confirm: (() => { const c = [...document.querySelectorAll('[data-slot=window-picker] button')].find((b) => b.textContent.trim() === 'Confirm'); return c ? { disabled: c.disabled, text: c.textContent.trim() } : null; })(),
  };
})()`);

// Measure the SELECT strip (the picker's first overflow-x-auto child): its scroll box,
// every card cell + card height/top, and the group dividers.
const stripProbe = (page) => page.eval(`(() => {
  const picker = document.querySelector('[data-slot=window-picker]');
  if (!picker) return null;
  const strips = [...picker.querySelectorAll(':scope > div')].filter((d) => d.classList.contains('overflow-x-auto'));
  const strip = strips[0] ?? null;
  if (!strip) return { stripFound: false };
  const cs = getComputedStyle(strip);
  const children = [...strip.children];
  const cells = children.filter((c) => c.classList.contains('window-card-cell'));
  const dividers = children.filter((c) => c.classList.contains('w-px') && c.classList.contains('row-span-2'));
  const cards = [...strip.querySelectorAll('[data-slot=role-card],[data-slot=general-action-card],[data-slot=player-card]')];
  const cardRow = cards.map((el) => {
    const r = el.getBoundingClientRect();
    const cell = el.closest('.window-card-cell');
    const cr = cell ? cell.getBoundingClientRect() : null;
    return {
      slot: el.getAttribute('data-slot'),
      label: (el.getAttribute('aria-label') || '').slice(0, 32),
      height: Math.round(r.height * 100) / 100,
      top: Math.round(r.top * 100) / 100,
      width: Math.round(r.width * 100) / 100,
      cellHeight: cr ? Math.round(cr.height * 100) / 100 : null,
    };
  });
  const dividerDump = dividers.map((d) => {
    const i = children.indexOf(d);
    const prev = children[i - 1] ?? null;
    const next = children[i + 1] ?? null;
    const prevSlot = prev ? prev.querySelector('[data-slot]')?.getAttribute('data-slot') ?? null : null;
    const nextSlot = next ? next.querySelector('[data-slot]')?.getAttribute('data-slot') ?? null : null;
    const r = d.getBoundingClientRect();
    return {
      ariaHidden: d.getAttribute('aria-hidden'),
      className: d.getAttribute('class'),
      width: Math.round(r.width * 100) / 100,
      height: Math.round(r.height * 100) / 100,
      between: [prevSlot, nextSlot],
      outerHTML: d.outerHTML,
    };
  });
  return {
    stripFound: true,
    scrollWidth: strip.scrollWidth,
    clientWidth: strip.clientWidth,
    offsetWidth: strip.offsetWidth,
    scrollLeft: strip.scrollLeft,
    scrolls: strip.scrollWidth > strip.clientWidth,
    overflowX: cs.overflowX,
    display: cs.display,
    gridTemplateRows: cs.gridTemplateRows,
    cardCount: cards.length,
    cellCount: cells.length,
    dividerCount: dividers.length,
    cardRow,
    dividerDump,
    stripOuterHTML: strip.outerHTML.slice(0, 1400),
  };
})()`);

const main = async () => {
  const { server, reused } = await startServer();
  if (reused) info("reusing the already-running dev server on port " + String(PORT));
  const host = await signUp("host");
  const guest = await signUp("guest");
  pass(`created accounts ${host.email} and ${guest.email}`);

  const hostBrowser = await launchBrowser("host", PORT + 61);
  const guestBrowser = await launchBrowser("guest", PORT + 62);
  try {
    await hostBrowser.page.setViewport(1280, 1100);
    await guestBrowser.page.setViewport(1280, 1100);
    await hostBrowser.page.setSessionCookie(host);
    await guestBrowser.page.setSessionCookie(guest);

    await hostBrowser.page.goto(`${BASE}/rooms/new`);
    await hostBrowser.page.waitForHydration();
    const pickerReady = await hostBrowser.page.waitFor("document.querySelectorAll('[data-role-option]').length === 31", { timeoutMs: 15000 });
    if (!pickerReady) throw new Error("the create page never rendered the 31-role picker");
    pass("create page hydrated with the 31-role picker");

    // The seats <select> is a reka-ui Select: it needs a real CDP mouse sequence.
    await hostBrowser.page.clickReal("document.querySelector('#seats')");
    const opened = await hostBrowser.page.waitFor("document.querySelectorAll('[role=option]').length >= 7", { timeoutMs: 4000 });
    if (!opened) throw new Error("the seats select did not open");
    await hostBrowser.page.clickReal(`[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === '2')`);
    const seatsValue = await hostBrowser.page.eval("document.querySelector('#seats')?.textContent.trim()");
    if (seatsValue !== "2") throw new Error(`seats select shows ${JSON.stringify(seatsValue)}, expected "2"`);
    pass("set the room to 2 seats through the reka-ui Select (real CDP pointer)");

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
    if (!hostBoard) throw new Error("host board missing");
    pass("host rendered the game board");

    const hostTurn = await hostBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 20000 });
    if (!hostTurn) {
      fail(`host turn window shows no [data-slot=window-picker]; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
      throw new Error("no turn picker for the host");
    }
    pass("host turn window shows [data-slot=window-picker]");
    const hostState = await pickerState(hostBrowser.page);
    info(`host turn: title=${JSON.stringify(hostState.title)} role-cards=${hostState.roleCards} general-cards=${hostState.generalCards} player-cards=${hostState.playerCards} confirm=${JSON.stringify(hostState.confirm)}`);

    // Narrow viewport: the select strip must scroll horizontally, its cards must
    // share one height, and the divider must render between the card groups.
    await hostBrowser.page.setViewport(900, 1100);
    await delay(400);
    const narrow = await stripProbe(hostBrowser.page);
    if (!narrow || !narrow.stripFound) {
      fail(`the select strip was not found; probe=${JSON.stringify(narrow)}`);
      throw new Error("no select strip");
    }
    info(`narrow: scrollWidth=${narrow.scrollWidth} clientWidth=${narrow.clientWidth} scrolls=${narrow.scrolls} overflowX=${narrow.overflowX} display=${narrow.display}`);
    console.log(`DOM narrow strip: ${narrow.stripOuterHTML}`);

    if (narrow.scrolls) pass(`the select strip scrolls horizontally (scrollWidth ${narrow.scrollWidth} > clientWidth ${narrow.clientWidth})`);
    else fail(`the select strip does not scroll at 900px (scrollWidth ${narrow.scrollWidth} <= clientWidth ${narrow.clientWidth})`);

    const heights = narrow.cardRow.map((c) => c.height);
    const cellHeights = narrow.cardRow.map((c) => c.cellHeight);
    const uniqHeights = [...new Set(heights)];
    const uniqCell = [...new Set(cellHeights)];
    console.log(`MEASURE narrow card heights: ${JSON.stringify(narrow.cardRow)}`);
    if (narrow.cardRow.length < 2) fail(`expected multiple cards in the select strip, saw ${narrow.cardRow.length}`);
    else if (uniqHeights.length === 1) pass(`all ${heights.length} select cards share height ${uniqHeights[0]} (cells: ${JSON.stringify(uniqCell)})`);
    else fail(`select card heights differ: ${JSON.stringify(narrow.cardRow.map((c) => [c.label, c.height]))}`);

    console.log(`MEASURE narrow dividers: ${JSON.stringify(narrow.dividerDump)}`);
    if (narrow.dividerCount === 1) pass(`exactly one divider (row-span-2 w-px, aria-hidden) between ${JSON.stringify(narrow.dividerDump[0].between)}`);
    else fail(`expected exactly one divider, saw ${narrow.dividerCount}`);

    const shot1 = await hostBrowser.page.screenshot("01-narrow-strip");
    console.log(`screenshot: ${shot1}`);

    // Wide viewport: every select card must sit on one row.
    await hostBrowser.page.setViewport(1280, 1100);
    await delay(400);
    const wide = await stripProbe(hostBrowser.page);
    info(`wide: scrollWidth=${wide.scrollWidth} clientWidth=${wide.clientWidth} scrolls=${wide.scrolls}`);
    const tops = wide.cardRow.map((c) => c.top);
    const uniqTops = [...new Set(tops)];
    info(`wide card tops: ${JSON.stringify(wide.cardRow.map((c) => [c.label, c.top, c.height]))}`);
    if (uniqTops.length === 1) pass(`at 1280px all ${tops.length} select cards share top offset ${uniqTops[0]}`);
    else fail(`select cards have differing tops at 1280px: ${JSON.stringify(wide.cardRow.map((c) => [c.label, c.top]))}`);
    const shot2 = await hostBrowser.page.screenshot("02-wide-strip");
    console.log(`screenshot: ${shot2}`);

    await hostBrowser.page.setViewport(900, 1100);
    await delay(400);

    const turnBefore = await turnNumber(hostBrowser.page);
    info(`host turn before Income: ${turnBefore}`);
    if (turnBefore !== 0) fail(`expected the first turn to be 0, saw ${String(turnBefore)}`);
    const beforeState = await pickerState(hostBrowser.page);
    if (beforeState.confirm === null || !beforeState.confirm.disabled) fail("Confirm must be disabled before a card is selected");
    else pass("Confirm is disabled before a card is selected");

    // A target role card opens a player-card strip; the select cards must keep
    // their height while that strip is open.
    const clickedPolitician = await hostBrowser.page.clickReal(EL.roleCard("Politician"));
    if (!clickedPolitician) fail(`could not select the Politician card; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    else pass("selected the Politician role card (needs a target)");
    const targetShown = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=player-card]')", { timeoutMs: 6000 });
    const targetState = await pickerState(hostBrowser.page);
    info(`host target stage: player-cards=${targetState.playerCards} confirm=${JSON.stringify(targetState.confirm)}`);
    if (!targetShown || targetState.playerCards < 1) fail("selecting Politician did not open a player-card target strip");
    else pass(`the target strip shows ${targetState.playerCards} [data-slot=player-card] element(s)`);

    await delay(300);
    const withTarget = await stripProbe(hostBrowser.page);
    const withTargetHeights = [...new Set(withTarget.cardRow.map((c) => c.height))];
    info(`with-target select card heights: ${JSON.stringify(withTarget.cardRow.map((c) => [c.label, c.height]))}`);
    if (withTargetHeights.length === 1 && withTargetHeights[0] === uniqHeights[0]) pass(`select cards keep height ${withTargetHeights[0]} with the target strip open`);
    else fail(`select card heights changed with the target strip open: before=${JSON.stringify(uniqHeights)} after=${JSON.stringify(withTargetHeights)}`);

    // The target strip must be its own overflow-x-auto strip of player-cards.
    const targetStrip = await hostBrowser.page.eval(`(() => {
      const picker = document.querySelector('[data-slot=window-picker]');
      const strips = [...picker.querySelectorAll('div.overflow-x-auto')];
      const t = strips.find((d) => d.querySelector('[data-slot=player-card]')) ?? null;
      if (!t) return { found: false, stripCount: strips.length };
      const cs = getComputedStyle(t);
      const cards = [...t.querySelectorAll('[data-slot=player-card]')].map((el) => {
        const r = el.getBoundingClientRect();
        return { label: el.getAttribute('aria-label'), height: Math.round(r.height * 100) / 100, top: Math.round(r.top * 100) / 100 };
      });
      return { found: true, stripCount: strips.length, role: t.getAttribute('role'), ariaLabel: t.getAttribute('aria-label'), overflowX: cs.overflowX, scrollWidth: t.scrollWidth, clientWidth: t.clientWidth, cards, outerHTML: t.outerHTML.slice(0, 700) };
    })()`);
    info(`target strip: ${JSON.stringify(targetStrip)}`);
    if (targetStrip.found && targetStrip.cards.length >= 1) pass(`the target strip is a separate overflow-x-auto strip (overflowX=${targetStrip.overflowX}) with ${targetStrip.cards.length} [data-slot=player-card]`);
    else fail(`no separate player-card target strip; probe=${JSON.stringify(targetStrip)}`);

    await delay(400);
    await hostBrowser.page.eval(`(() => {
      const picker = document.querySelector('[data-slot=window-picker]');
      picker.querySelectorAll('div.overflow-x-auto').forEach((d) => { d.scrollLeft = 0; });
      picker.scrollIntoView({ block: 'center' });
    })()`);
    await delay(300);
    const shot3 = await hostBrowser.page.screenshot("03-target-strip", { fullPage: true });
    console.log(`screenshot: ${shot3}`);

    // Income still advances the turn through the staged flow.
    const clickedIncome = await hostBrowser.page.clickReal(EL.generalCard("Income"));
    if (!clickedIncome) fail(`the Income card was not clickable; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    else pass("selected the Income general action card");
    const selectedState = await pickerState(hostBrowser.page);
    if (selectedState.confirm === null || selectedState.confirm.disabled) fail("Confirm must enable after selecting Income");
    else pass("Confirm enabled after selecting Income");

    const confirmed = await hostBrowser.page.clickReal(EL.confirm);
    if (!confirmed) fail("the Confirm button was not clickable");
    else pass("clicked Confirm on Income");
    const hostCleared = await hostBrowser.page.waitFor(`!document.querySelector('${EL.picker}')`, { timeoutMs: 12000 });
    const turnAfter = await turnNumber(hostBrowser.page);
    info(`host turn after Income: ${turnAfter}; picker cleared: ${hostCleared}`);
    if (turnBefore === 0 && turnAfter === 1) pass("turn advanced 0 -> 1");
    else fail(`turn did not advance 0 -> 1: ${String(turnBefore)} -> ${String(turnAfter)}`);

    console.log(`\nRESULT narrow scrollWidth=${narrow.scrollWidth} clientWidth=${narrow.clientWidth} scrolls=${narrow.scrolls} | cardHeights=${JSON.stringify(heights)} | dividers=${narrow.dividerCount} | wide tops=${JSON.stringify(uniqTops)} | turn ${String(turnBefore)}->${String(turnAfter)}`);
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
  console.log("\nall hand-strip layout proof checks passed");
}
