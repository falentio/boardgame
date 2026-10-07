// Live proof of the staged window picker: the active seat's turn window renders
// action, role, and player cards; selecting a card and clicking Confirm advances
// the turn; a staged claim opens a player-card target stage, and the rival then
// sees a challenge window of cards.
//
// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth
// rejects the sign-up with INVALID_ORIGIN.
//
// Usage: node scripts/proof-window-picker.mjs [--port 3000] [--out DIR] [--keep]
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
  const email = `picker-${label}-${STAMP}@example.com`;
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
  const profileDir = `/tmp/proof-picker-${label}-${PORT}-${process.pid}`;
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
    confirm: (() => { const c = [...document.querySelectorAll('[data-slot=window-picker] button')].find((b) => b.textContent.trim() === 'Confirm'); return c ? { disabled: c.disabled } : null; })(),
  };
})()`);

const main = async () => {
  const { server, reused } = await startServer();
  if (reused) console.warn("note: reusing an already-running dev server; not validated as this checkout");
  const host = await signUp("host");
  const guest = await signUp("guest");
  pass(`created accounts ${host.email} and ${guest.email}`);

  const hostBrowser = await launchBrowser("host", PORT + 41);
  const guestBrowser = await launchBrowser("guest", PORT + 42);
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

    await guestBrowser.page.goto(`${BASE}/games/${code}`);
    await hostBrowser.page.waitForHydration();
    await guestBrowser.page.waitForHydration();

    const hostBoard = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    const guestBoard = await guestBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    if (!hostBoard || !guestBoard) throw new Error(`board missing (host ${hostBoard}, guest ${guestBoard})`);
    pass("both seats rendered the game board");

    const hostTurn = await hostBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 20000 });
    if (!hostTurn) {
      fail(`host turn window shows no [data-slot=window-picker]; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass("host turn window shows [data-slot=window-picker]");
    }
    const hostState = await pickerState(hostBrowser.page);
    info(`host turn: title=${JSON.stringify(hostState.title)} role-cards=${hostState.roleCards} general-cards=${hostState.generalCards} player-cards=${hostState.playerCards} confirm=${JSON.stringify(hostState.confirm)}`);
    if (hostState.roleCards < 1) fail(`expected role cards in the turn window, got ${hostState.roleCards}`);
    else pass(`the turn window renders ${hostState.roleCards} [data-slot=role-card] elements`);
    if (hostState.generalCards < 1) fail(`expected general action cards, got ${hostState.generalCards}`);
    else pass(`the turn window renders ${hostState.generalCards} [data-slot=general-action-card] elements`);
    if (hostState.confirm === null || !hostState.confirm.disabled) fail("Confirm must be disabled before a card is selected");
    else pass("Confirm is disabled before a card is selected");

    const shot1 = await hostBrowser.page.screenshot("picker-01-host-turn");
    console.log(`screenshot: ${shot1}`);

    // Step 1 + 3: select Income, then Confirm.
    const turnBefore = await turnNumber(hostBrowser.page);
    info(`host turn before Income: ${turnBefore}`);
    const clickedIncome = await hostBrowser.page.clickReal(EL.generalCard("Income"));
    if (!clickedIncome) fail(`the Income card was not clickable; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    else pass("selected the Income general action card");
    const selectedState = await pickerState(hostBrowser.page);
    if (selectedState.confirm === null || selectedState.confirm.disabled) fail("Confirm must enable after selecting Income");
    else pass("Confirm enabled after selecting Income");

    const shot2 = await hostBrowser.page.screenshot("picker-02-host-income-selected");
    console.log(`screenshot: ${shot2}`);

    const confirmed = await hostBrowser.page.clickReal(EL.confirm);
    if (!confirmed) fail("the Confirm button was not clickable");
    else pass("clicked Confirm");
    const hostCleared = await hostBrowser.page.waitFor(`!document.querySelector('${EL.picker}')`, { timeoutMs: 12000 });
    const turnAfter = await turnNumber(hostBrowser.page);
    info(`host turn after Income: ${turnAfter}; picker cleared: ${hostCleared}`);
    if (!hostCleared) fail(`the host picker did not clear after Confirm; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    else pass("the host's picker cleared after Confirm (turn advanced)");
    if (turnAfter !== null && turnBefore !== null && turnAfter !== turnBefore + 1) fail(`turn did not advance by 1: ${turnBefore} -> ${turnAfter}`);
    else if (turnAfter !== null) pass(`turn advanced ${turnBefore} -> ${turnAfter}`);

    // The guest's turn: same flow, then the host claims with a target.
    const guestTurn = await guestBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 15000 });
    if (!guestTurn) fail(`guest turn window shows no [data-slot=window-picker]; body: ${(await guestBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    else pass("guest turn window shows [data-slot=window-picker]");
    const guestIncome = await guestBrowser.page.clickReal(EL.generalCard("Income"));
    if (!guestIncome) fail("guest could not select Income");
    else pass("guest selected Income");
    const guestConfirmed = await guestBrowser.page.clickReal(EL.confirm);
    if (!guestConfirmed) fail("guest could not click Confirm");
    else pass("guest confirmed Income; the turn returns to the host");

    const hostAgain = await hostBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 15000 });
    if (!hostAgain) throw new Error("host never regained the turn window");
    pass("host is active again for the claim");

    // Step 2: a staged claim opens a player-card target stage.
    const clickedPolitician = await hostBrowser.page.clickReal(EL.roleCard("Politician"));
    if (!clickedPolitician) fail(`host could not select the Politician card; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    else pass("host selected the Politician card (needs a target)");
    const targetShown = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=player-card]')", { timeoutMs: 6000 });
    const targetState = await pickerState(hostBrowser.page);
    info(`host target stage: player-cards=${targetState.playerCards} confirm=${JSON.stringify(targetState.confirm)}`);
    if (!targetShown || targetState.playerCards < 1) fail("selecting Politician did not open a player-card target stage");
    else pass(`the target stage shows ${targetState.playerCards} [data-slot=player-card] element(s)`);

    await hostBrowser.page.eval("document.querySelector('[data-slot=player-card]')?.scrollIntoView({ block: 'center' })");
    await delay(300);
    const shot3 = await hostBrowser.page.screenshot("picker-03-host-target-stage");
    console.log(`screenshot: ${shot3}`);

    const pickedTarget = await hostBrowser.page.clickReal(EL.playerCard(guest.name), { attempts: 8 });
    if (!pickedTarget) fail(`host could not pick the target "${guest.name}"; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    else pass(`host picked ${guest.name} as the Politician target`);
    const targetConfirm = await pickerState(hostBrowser.page);
    if (targetConfirm.confirm === null || targetConfirm.confirm.disabled) fail("Confirm must enable after picking a target");
    else pass("Confirm enabled after picking the target");
    await hostBrowser.page.clickReal(EL.confirm);

    // The rival now sees the challenge window as cards.
    const guestChallenge = await guestBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 15000 });
    const guestState = await pickerState(guestBrowser.page);
    info(`guest challenge: title=${JSON.stringify(guestState.title)} general-cards=${guestState.generalCards}`);
    if (!guestChallenge) fail(`the guest did not see the challenge window; body: ${(await guestBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    else pass(`the guest sees [data-slot=window-picker] titled ${JSON.stringify(guestState.title)}`);
    const hasChallenge = await guestBrowser.page.eval(`!!${EL.generalCard("Challenge")}`);
    const hasPass = await guestBrowser.page.eval(`!!${EL.generalCard("Pass")}`);
    if (!hasChallenge) fail("the challenge window has no Challenge card");
    else pass("the challenge window has a Challenge card");
    if (!hasPass) fail("the challenge window has no Pass card");
    else pass("the challenge window has a Pass card");

    const shot4 = await guestBrowser.page.screenshot("picker-04-guest-challenge");
    console.log(`screenshot: ${shot4}`);

    // The claimant has no choice in the challenge window: the engine skips them as
    // a challenger, so their only report is Pass. It must be auto-reported, not shown
    // as a one-card picker.
    const hostAuto = await hostBrowser.page.waitFor(
      `!document.querySelector('${EL.picker}')`,
      { timeoutMs: 12000 },
    );
    const hostWaiting = await hostBrowser.page.eval(
      `document.body.innerText.includes('Waiting for the other players')`,
    );
    if (!hostAuto) fail(`the claimant still sees a one-card picker; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    else if (!hostWaiting) fail("the claimant's forced Pass did not show the waiting status");
    else pass("the claimant's forced Pass is auto-reported; no one-card picker shown");

    const shot5 = await hostBrowser.page.screenshot("picker-05-claimant-waiting");
    console.log(`screenshot: ${shot5}`);

    console.log(`\nRESULT: host-turn role-cards=${hostState.roleCards} general-cards=${hostState.generalCards} target-stage player-cards=${targetState.playerCards} guest-challenge Challenge=${hasChallenge} Pass=${hasPass} claimant-auto=${hostAuto && hostWaiting}`);
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
  console.log("\nall window-picker proof checks passed");
}
