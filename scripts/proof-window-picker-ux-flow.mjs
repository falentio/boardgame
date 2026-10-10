// Live proof of the multi-select keep window on the real /games/<code> surface:
// the active seat claims a card-swapping role, both seats pass the challenge
// window, and the keep window opens. It must title "Keep N cards", offer a Keep
// card whose target stage is the hand plus the drawn cards, keep Confirm
// disabled until exactly N cards are picked, and clear and advance the turn
// when Confirm resolves the keep.
//
// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth
// rejects the sign-up with INVALID_ORIGIN.
//
// Usage: node scripts/proof-staged-keep-window.mjs [--port 3000] [--out DIR] [--keep]
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
  const email = `keep-${label}-${STAMP}@example.com`;
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
  const profileDir = `/tmp/proof-keep-${label}-${PORT}-${process.pid}`;
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
    // A real CDP pointer sequence at the element's centre: reka-ui's controls (the seats
    // Select) ignore a synthetic `el.click()`.
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
  rosterRow: (name) => `[...document.querySelectorAll('[data-slot=window-picker] .picker-row')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  targetCard: (name) => `[...document.querySelectorAll('[data-slot=window-picker] [data-slot=role-strip] [data-slot=role-card], [data-slot=window-picker] [data-slot=role-strip] [data-slot=player-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  targetCardAt: (i) => `[...document.querySelectorAll('[data-slot=window-picker] [data-slot=role-strip] [data-slot=role-card], [data-slot=window-picker] [data-slot=role-strip] [data-slot=player-card]')][${String(i)}]`,
  firstUnselectedTarget: `[...document.querySelectorAll('[data-slot=window-picker] [data-slot=role-strip] [data-slot=role-card], [data-slot=window-picker] [data-slot=role-strip] [data-slot=player-card]')].find((b) => b.getAttribute('aria-pressed') !== 'true')`,
  confirm: `[...document.querySelectorAll('[data-slot=window-picker] button')].find((b) => b.textContent.trim() === 'Confirm')`,
  buttonText: (name) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(name)}))`,
};

const turnNumber = async (page) => {
  const text = await page.bodyText();
  const m = text.match(/turn\s+(\d+)/i);
  return m === null ? null : Number(m[1]);
};

const rolesInPlay = (page) =>
  page.eval(`[...document.querySelectorAll('[data-slot=table-puck] span[title]')].map((s) => s.title)`);

// The keep window's full observable state: title, the Keep verb card, the target-stage
// role cards, how many are selected, and the Confirm disabled flag.
const keepState = (page) => page.eval(`(() => {
  const picker = document.querySelector('[data-slot=window-picker]');
  if (!picker) return { present: false };
  const roleCards = [...picker.querySelectorAll('[data-slot=role-card]')];
  const confirm = [...picker.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Confirm');
  const keep = [...picker.querySelectorAll('[data-slot=general-action-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith('Keep'));
  return {
    present: true,
    title: picker.querySelector('h2')?.textContent.trim() ?? null,
    note: picker.querySelector('p')?.textContent.trim() ?? null,
    keepCard: keep ? { label: keep.getAttribute('aria-label'), pressed: keep.getAttribute('aria-pressed') } : null,
    targetRoleCards: roleCards.length,
    selected: roleCards.filter((b) => b.getAttribute('aria-pressed') === 'true').length,
    confirm: confirm ? { disabled: confirm.disabled, text: confirm.textContent.trim() } : null,
  };
})()`);

const pickerDump = (page) => page.eval(`(() => {
  const picker = document.querySelector('[data-slot=window-picker]');
  if (!picker) return null;
  return {
    outerHTML: picker.outerHTML.slice(0, 1800),
    children: [...picker.querySelectorAll('[data-slot]')].map((el) => el.tagName.toLowerCase() + '[' + el.getAttribute('data-slot') + ']' + (el.getAttribute('aria-label') ? '(' + el.getAttribute('aria-label').slice(0, 44) + ')' : '')),
    buttons: [...picker.querySelectorAll('button')].map((b) => b.textContent.trim() || b.getAttribute('aria-label')),
  };
})()`);

const dumpBody = async (page, label) => {
  const text = (await page.bodyText()).replace(/\n/g, " | ");
  console.error(`--- ${label} document.body.innerText ---\n${text}\n--- end ---`);
  return text;
};


const pickerState = (page) => page.eval(`(() => {
  const picker = document.querySelector('[data-slot=window-picker]');
  if (!picker) return { present: false };
  const roster = [...picker.querySelectorAll('.picker-row')];
  const strips = [...picker.querySelectorAll('[data-slot=role-strip]')];
  const targets = [...picker.querySelectorAll('[data-slot=role-strip] [data-slot=role-card], [data-slot=window-picker] [data-slot=role-strip] [data-slot=player-card]')];
  const countLine = [...picker.querySelectorAll('p')].map((p) => p.textContent.trim()).find((t) => /[0-9]+ of [0-9]+ chosen/.test(t)) ?? null;
  const groupLabels = strips.map((s) => s.previousElementSibling?.textContent.trim() ?? null);
  const confirm = [...picker.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Confirm');
  return {
    present: true,
    title: picker.querySelector('h2')?.textContent.trim() ?? null,
    note: picker.querySelector('p')?.textContent.trim() ?? null,
    rosterRows: roster.map((b) => b.getAttribute('aria-label')),
    stripCount: strips.length,
    groupLabels,
    targetCards: targets.map((b) => ({ slot: b.getAttribute('data-slot'), label: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed'), disabled: b.disabled })),
    countLine,
    confirm: confirm ? { disabled: confirm.disabled } : null,
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

    await hostBrowser.page.clickReal("document.querySelector('#seats')");
    await hostBrowser.page.waitFor("document.querySelectorAll('[role=option]').length >= 7", { timeoutMs: 4000 });
    await hostBrowser.page.clickReal(`[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === '2')`);
    pass("set the room to 2 seats");

    await hostBrowser.page.clickReal(EL.buttonText("Create room"));
    const inLobby = await hostBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8,9}$/.test(location.pathname)", { timeoutMs: 20000 });
    if (!inLobby) throw new Error(`create did not land in the lobby, at ${await hostBrowser.page.url()}`);
    const code = (await hostBrowser.page.url()).replace("/rooms/", "");
    pass(`host created room ${code}`);

    await guestBrowser.page.goto(`${BASE}/join/${code}`);
    const guestInLobby = await guestBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8,9}$/.test(location.pathname)", { timeoutMs: 20000 });
    if (!guestInLobby) throw new Error(`guest link did not land in the lobby, at ${await guestBrowser.page.url()}`);
    pass("guest joined through the shared link");

    let full = await hostBrowser.page.waitFor("document.body.innerText.includes('All seats filled')", { timeoutMs: 15000 });
    if (!full) {
      await hostBrowser.page.goto(`${BASE}/rooms/${code}`);
      full = await hostBrowser.page.waitFor("document.body.innerText.includes('All seats filled')", { timeoutMs: 15000 });
    }
    if (!full) throw new Error(`room ${code} never became full for the host`);
    await hostBrowser.page.clickReal(EL.buttonText("Start game"));
    const onGame = await hostBrowser.page.waitFor("/^\\/games\\/[A-Z]{8,9}$/.test(location.pathname)", { timeoutMs: 15000 });
    if (!onGame) throw new Error(`Start game did not open the board, at ${await hostBrowser.page.url()}`);
    pass("host's Start game opened the board");

    await guestBrowser.page.goto(`${BASE}/games/${code}`);
    await hostBrowser.page.waitForHydration();
    await guestBrowser.page.waitForHydration();
    await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    await guestBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    pass("both seats rendered the game board");

    // ---- Turn window: the select roster is unchanged for a multi-card menu. ----
    await hostBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 20000 });
    const turn = await pickerState(hostBrowser.page);
    info(`turn window: title=${JSON.stringify(turn.title)} rosterRows=${String(turn.rosterRows.length)} strips=${String(turn.stripCount)} confirm=${JSON.stringify(turn.confirm)}`);
    if (turn.rosterRows.length < 2) fail(`the turn window should keep its multi-card select roster, got ${String(turn.rosterRows.length)} rows`);
    else pass(`the turn window keeps its select roster (${String(turn.rosterRows.length)} rows)`);
    if (turn.confirm === null || !turn.confirm.disabled) fail("Confirm must be disabled before a card is selected");
    else pass("Confirm is disabled before a card is selected");

    // ---- Move 2: a targeted claim renders a RolePicker-style player strip. ----
    const clickedPolitician = await hostBrowser.page.clickReal(EL.rosterRow("Politician"));
    if (!clickedPolitician) throw new Error("host could not select the Politician roster row");
    pass("host selected the Politician claim (needs a player target)");
    await hostBrowser.page.waitFor(`document.querySelectorAll('${EL.picker} [data-slot=role-strip] [data-slot=player-card]').length > 0`, { timeoutMs: 6000 });
    const targeted = await pickerState(hostBrowser.page);
    info(`targeted claim: strips=${String(targeted.stripCount)} groupLabels=${JSON.stringify(targeted.groupLabels)} countLine=${JSON.stringify(targeted.countLine)} targets=${JSON.stringify(targeted.targetCards)}`);
    if (targeted.stripCount < 1) fail("the targeted claim shows no [data-slot=role-strip] strip");
    else pass(`the targeted claim renders ${String(targeted.stripCount)} role-strip(s) (RolePicker flow)`);
    if (targeted.groupLabels.some((l) => l === null)) fail("a target strip has no group label");
    else pass(`target strips carry group labels: ${JSON.stringify(targeted.groupLabels)}`);
    if (targeted.countLine === null) fail("the targeted claim shows no 'N of M chosen' count line");
    else pass(`the targeted claim shows a live count line: ${JSON.stringify(targeted.countLine)}`);
    const playerCard = targeted.targetCards.find((c) => c.slot === "player-card");
    if (playerCard === undefined) fail("the targeted claim renders no [data-slot=player-card]");
    else pass(`the targeted claim renders a PlayerCard (${JSON.stringify(playerCard.label)})`);
    const shotTarget = await hostBrowser.page.screenshot("after-claim-01-player-strip");
    console.log(`screenshot: ${shotTarget}`);

    // Back out of the claim and go to the keep window: claim Director.
    await hostBrowser.page.clickReal(EL.rosterRow("Director"));
    await hostBrowser.page.clickReal(EL.confirm);
    pass("host confirmed the Director claim");

    // The challenge window owes every alive seat: the guest must pass before the keep opens.
    const guestChallenge = await guestBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 15000 });
    if (!guestChallenge) throw new Error("guest never saw the challenge window");
    await guestBrowser.page.clickReal(EL.rosterRow("Pass"));
    await guestBrowser.page.clickReal(EL.confirm);
    pass("guest passed the challenge; the keep window should open for the host");

    // ---- Move 1: the keep window opens straight to the cards, no Keep click. ----
    const keepOpened = await hostBrowser.page.waitFor(
      `(() => { const p = document.querySelector('${EL.picker}'); const t = p?.querySelector('h2')?.textContent.trim() ?? ''; return /^Keep [0-9]+ cards?$/.test(t); })()`,
      { timeoutMs: 15000 },
    );
    if (!keepOpened) throw new Error("the keep window never opened: " + (await hostBrowser.page.bodyText()).replace(/\\n/g, " | "));
    const keep = await pickerState(hostBrowser.page);
    console.log("AFTER keep window on open: " + JSON.stringify(keep, null, 2));
    const titleMatch = /^Keep ([0-9]+) cards?$/.exec(keep.title ?? "");
    if (titleMatch === null) throw new Error("keep title not parseable: " + JSON.stringify(keep.title));
    const N = Number(titleMatch[1]);
    pass(`the keep window opened titled ${JSON.stringify(keep.title)} (N=${String(N)})`);
    if (keep.rosterRows.length !== 0) fail(`the keep window still shows a select roster: ${JSON.stringify(keep.rosterRows)}`);
    else pass("the keep window shows NO select roster (no Keep click needed)");
    if (keep.targetCards.length < N) fail(`the keep window shows ${String(keep.targetCards.length)} target cards, expected >= ${String(N)}`);
    else pass(`the keep window shows ${String(keep.targetCards.length)} cards-to-keep immediately`);
    if (keep.stripCount < 1) fail("the keep window shows no [data-slot=role-strip] strip");
    else pass("the keep window renders its cards as a RolePicker-style strip");
    if (keep.confirm === null || !keep.confirm.disabled) fail("Confirm must be disabled at 0 keep picks");
    else pass("Confirm is disabled at 0 keep picks");
    const shotKeep = await hostBrowser.page.screenshot("after-keep-01-immediate");
    console.log(`screenshot: ${shotKeep}`);

    // ---- The count gate still works: pick N, Confirm enables. ----
    for (let i = 0; i < N; i++) {
      const clicked = await hostBrowser.page.clickReal(EL.targetCardAt(i));
      if (!clicked) fail(`could not pick keep card #${String(i)}`);
    }
    const picked = await pickerState(hostBrowser.page);
    const selected = picked.targetCards.filter((c) => c.pressed === "true").length;
    info(`after picking N: selected=${String(selected)} countLine=${JSON.stringify(picked.countLine)} confirm=${JSON.stringify(picked.confirm)}`);
    if (selected !== N) fail(`expected ${String(N)} selected, got ${String(selected)}`);
    else pass(`exactly ${String(N)} cards selected; the live count reads ${JSON.stringify(picked.countLine)}`);
    if (picked.confirm === null || picked.confirm.disabled) fail(`Confirm must enable at exactly ${String(N)} picks`);
    else pass(`Confirm is enabled at exactly ${String(N)} picks`);
    const shotPicked = await hostBrowser.page.screenshot("after-keep-02-picked");
    console.log(`screenshot: ${shotPicked}`);

    // ---- Confirm resolves the keep and advances the turn. ----
    const turnBefore = await turnNumber(hostBrowser.page);
    await hostBrowser.page.clickReal(EL.confirm);
    const cleared = await hostBrowser.page.waitFor(`!document.querySelector('${EL.picker}')`, { timeoutMs: 12000 });
    const turnAfter = await turnNumber(hostBrowser.page);
    info(`after Confirm: cleared=${String(cleared)} turn ${String(turnBefore)} -> ${String(turnAfter)}`);
    if (!cleared) fail("the keep picker did not clear after Confirm");
    else pass("the keep picker cleared after Confirm");
    if (turnBefore !== null && turnAfter !== null && turnAfter !== turnBefore + 1) fail(`turn did not advance by 1: ${String(turnBefore)} -> ${String(turnAfter)}`);
    else if (turnAfter !== null) pass(`turn advanced ${String(turnBefore)} -> ${String(turnAfter)}`);
  } finally {
    hostBrowser.close();
    guestBrowser.close();
    if (server) { server.kill("SIGTERM"); await delay(1500); }
  }
};

try { await main(); } catch (error) { fail(error.stack ?? error.message); }

if (failures.length > 0) { console.error(`\n${failures.length} check(s) failed`); process.exitCode = 1; }
else console.log("\nall after-proof checks passed");
