// Live proof of the production turn window: the active seat's turn window
// renders action cards, and a non-turn window (challenge-claim) still renders
// buttons.
//
// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth
// rejects the sign-up with INVALID_ORIGIN.
//
// Usage: node scripts/proof-turn-cards.mjs [--port 3000] [--keep]
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
const PROOF = new URL("../.audit/proof/", import.meta.url).pathname;
const STAMP = Date.now();
const PASSWORD = "proof-password-123";

mkdirSync(PROOF, { recursive: true });

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
  const email = `turn-${label}-${STAMP}@example.com`;
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
  const profileDir = `/tmp/proof-turn-${label}-${PORT}-${process.pid}`;
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
      await delay(200);
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
    // A real CDP pointer sequence at the element's centre, because reka-ui's
    // controls ignore a synthetic `el.click()`.
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
      const path = `${PROOF}${name}.png`;
      writeFileSync(path, Buffer.from(result.data, "base64"));
      return path;
    },
  };
  return { chrome, page, close: () => chrome.kill("SIGKILL") };
};

const EL = {
  roleCard: (name) => `[...document.querySelectorAll('button[data-slot=role-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  generalCard: (name) => `[...document.querySelectorAll('button[data-slot=general-action-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  targetButton: (name) => `[...document.querySelectorAll('[data-slot=turn-action-picker] button')].find((b) => b.textContent.trim() === ${JSON.stringify(name)})`,
  buttonText: (name) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(name)}))`,
};

const turnNumber = async (page) => {
  const text = await page.bodyText();
  const m = text.match(/turn\s+(\d+)/i);
  return m === null ? null : Number(m[1]);
};

const main = async () => {
  const { server, reused } = await startServer();
  if (reused) console.warn("note: reusing an already-running dev server; not validated as this checkout");
  const host = await signUp("host");
  const guest = await signUp("guest");
  pass(`created accounts ${host.email} and ${guest.email}`);

  const hostBrowser = await launchBrowser("host", PORT + 31);
  const guestBrowser = await launchBrowser("guest", PORT + 32);
  try {
    await hostBrowser.page.setViewport(1280, 1000);
    await guestBrowser.page.setViewport(1280, 1000);
    await hostBrowser.page.setSessionCookie(host);
    await guestBrowser.page.setSessionCookie(guest);

    await hostBrowser.page.goto(`${BASE}/rooms/new`);
    await hostBrowser.page.waitForHydration();
    const pickerReady = await hostBrowser.page.waitFor("document.querySelectorAll('[data-role-option]').length === 31", { timeoutMs: 15000 });
    if (!pickerReady) throw new Error("the create page never rendered the 31-role picker");
    pass("create page hydrated with the 31-role picker");

    // The seats <select> is a reka-ui Select, so it needs a real pointer sequence.
    await hostBrowser.page.clickReal("document.querySelector('#seats')");
    const opened = await hostBrowser.page.waitFor("document.querySelectorAll('[role=option]').length >= 7", { timeoutMs: 4000 });
    if (!opened) throw new Error("the seats select did not open");
    await hostBrowser.page.clickReal(`[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === '2')`);
    const seatsValue = await hostBrowser.page.eval("document.querySelector('#seats')?.textContent.trim()");
    if (seatsValue !== "2") throw new Error(`seats select shows ${JSON.stringify(seatsValue)}, expected "2"`);
    pass("set the room to 2 seats through the reka-ui Select");

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

    // The lobby does not auto-navigate the guest, so take it to the board too.
    await guestBrowser.page.goto(`${BASE}/games/${code}`);
    await hostBrowser.page.waitForHydration();
    await guestBrowser.page.waitForHydration();

    const hostBoard = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    const guestBoard = await guestBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    if (!hostBoard || !guestBoard) throw new Error(`board missing (host ${hostBoard}, guest ${guestBoard})`);
    pass("both seats rendered the game board");

    const hostPicker = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=turn-action-picker]')", { timeoutMs: 20000 });
    if (!hostPicker) {
      fail(`host turn window is not the card picker; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass("host turn window shows [data-slot=turn-action-picker]");
    }

    const hostState = await hostBrowser.page.eval(`(() => ({
      picker: !!document.querySelector('[data-slot=turn-action-picker]'),
      menu: document.querySelector('[data-slot=window-menu]'),
      roleCards: document.querySelectorAll('[data-slot=role-card]').length,
      generalCards: document.querySelectorAll('[data-slot=general-action-card]').length,
      roleLabels: [...document.querySelectorAll('[data-slot=role-card]')].map((c) => c.getAttribute('aria-label')),
      generalLabels: [...document.querySelectorAll('[data-slot=general-action-card]')].map((c) => c.getAttribute('aria-label')),
    }))()`);
    info(`host picker=${hostState.picker} window-menu=${hostState.menu === null ? "null" : "present"} role-cards=${hostState.roleCards} general-cards=${hostState.generalCards}`);
    info(`host role cards: ${JSON.stringify(hostState.roleLabels)}`);
    info(`host general cards: ${JSON.stringify(hostState.generalLabels)}`);

    if (hostState.menu !== null) fail("the turn window must NOT render [data-slot=window-menu]");
    else pass("the turn window does NOT render [data-slot=window-menu]");
    if (hostState.roleCards !== 5) fail(`expected 5 role cards for the starter set, got ${hostState.roleCards}`);
    else pass("the picker renders 5 [data-slot=role-card] elements");
    if (hostState.generalCards < 1) fail(`expected general action cards, got ${hostState.generalCards}`);
    else pass(`the picker renders ${hostState.generalCards} [data-slot=general-action-card] elements`);

    const shot1 = await hostBrowser.page.screenshot("turn-cards-01-host-cards");
    console.log(`screenshot: ${shot1}`);

    const turnBefore = await turnNumber(hostBrowser.page);
    info(`host turn before Income: ${turnBefore}`);
    const clickedIncome = await hostBrowser.page.clickReal(EL.generalCard("Income"));
    if (!clickedIncome) {
      fail(`the Income general action card was not clickable; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass("clicked the Income general action card");
    }
    const hostPickerCleared = await hostBrowser.page.waitFor("!document.querySelector('[data-slot=turn-action-picker]')", { timeoutMs: 12000 });
    const turnAfter = await turnNumber(hostBrowser.page);
    info(`host turn after Income: ${turnAfter}; picker cleared: ${hostPickerCleared}`);
    if (!hostPickerCleared) {
      fail(`the host picker did not clear after Income; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass("the host's turn picker cleared after Income (turn advanced)");
    }
    if (turnAfter !== null && turnBefore !== null && turnAfter !== turnBefore + 1) {
      fail(`turn did not advance by 1: ${turnBefore} -> ${turnAfter}`);
    } else if (turnAfter !== null) {
      pass(`turn advanced ${turnBefore} -> ${turnAfter}`);
    }
    const shot2 = await hostBrowser.page.screenshot("turn-cards-02-after-income");
    console.log(`screenshot: ${shot2}`);

    const guestPicker = await guestBrowser.page.waitFor("!!document.querySelector('[data-slot=turn-action-picker]')", { timeoutMs: 15000 });
    if (!guestPicker) {
      fail(`guest turn window is not the card picker; body: ${(await guestBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass("guest turn window also shows [data-slot=turn-action-picker]");
      const guestMenu = await guestBrowser.page.eval("!!document.querySelector('[data-slot=window-menu]')");
      if (guestMenu) fail("guest turn window must NOT render [data-slot=window-menu]");
      else pass("guest turn window does NOT render [data-slot=window-menu]");
      const guestIncome = await guestBrowser.page.clickReal(EL.generalCard("Income"));
      if (!guestIncome) fail("guest could not click Income");
      else pass("guest clicked Income; the turn returns to the host");
    }
    const hostPickerAgain = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=turn-action-picker]')", { timeoutMs: 15000 });
    if (!hostPickerAgain) throw new Error("host never regained the turn window");
    pass("host is active again for the claim");

    const claimClicked = await hostBrowser.page.clickReal(EL.roleCard("Politician"));
    if (!claimClicked) {
      fail(`host could not click the Politician role card; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass("host clicked the Politician role card (needs a target)");
    }
    const targetClicked = await hostBrowser.page.clickReal(EL.targetButton(guest.name), { attempts: 8 });
    if (!targetClicked) {
      fail(`host could not pick the target "${guest.name}"; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass(`host picked ${guest.name} as the Politician target`);
    }

    const guestMenuShown = await guestBrowser.page.waitFor("!!document.querySelector('[data-slot=window-menu]')", { timeoutMs: 15000 });
    const guestAfter = await guestBrowser.page.eval(`(() => ({
      menu: document.querySelector('[data-slot=window-menu]'),
      menuTitle: document.querySelector('[data-slot=window-menu] h2')?.textContent.trim() ?? null,
      buttons: [...document.querySelectorAll('[data-slot=window-menu] button')].map((b) => b.textContent.trim()),
      picker: !!document.querySelector('[data-slot=turn-action-picker]'),
      roleCards: document.querySelectorAll('[data-slot=role-card]').length,
      generalCards: document.querySelectorAll('[data-slot=general-action-card]').length,
    }))()`);
    info(`guest after claim: window-menu=${guestAfter.menu === null ? "null" : "present"} title=${JSON.stringify(guestAfter.menuTitle)} buttons=${JSON.stringify(guestAfter.buttons)} picker=${guestAfter.picker}`);

    if (!guestMenuShown || guestAfter.menu === null) {
      fail(`the guest did not see [data-slot=window-menu]; body: ${(await guestBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass(`the guest sees [data-slot=window-menu] titled "${guestAfter.menuTitle}"`);
    }
    const hasChallenge = guestAfter.buttons.some((b) => /challenge/i.test(b));
    const hasPass = guestAfter.buttons.some((b) => /pass/i.test(b));
    if (!hasChallenge) fail(`the guest window-menu has no Challenge button; buttons: ${JSON.stringify(guestAfter.buttons)}`);
    else pass("the guest window-menu has a Challenge button");
    if (!hasPass) fail(`the guest window-menu has no Pass button; buttons: ${JSON.stringify(guestAfter.buttons)}`);
    else pass("the guest window-menu has a Pass button");
    if (guestAfter.picker) fail("the guest must NOT show [data-slot=turn-action-picker] during the challenge window");
    else pass("the guest does NOT show [data-slot=turn-action-picker] during the challenge window");
    if (guestAfter.roleCards > 0 || guestAfter.generalCards > 0) {
      fail(`the guest challenge window must not render card pickers; role-cards=${guestAfter.roleCards} general-cards=${guestAfter.generalCards}`);
    } else {
      pass("the guest challenge window renders no role/general action cards");
    }

    const shot3 = await guestBrowser.page.screenshot("turn-cards-03-guest-buttons");
    console.log(`screenshot: ${shot3}`);

    console.log(`\nRESULT: role-cards(host turn)=${hostState.roleCards} general-cards(host turn)=${hostState.generalCards} window-menu(host turn)=${hostState.menu === null ? "null" : "present"} guest-challenge-buttons=${JSON.stringify(guestAfter.buttons)}`);
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
  console.log("\nall turn-card proof checks passed");
}
