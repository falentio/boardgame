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
  roleCard: (name) => `[...document.querySelectorAll('[data-slot=window-picker] button[data-slot=role-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  generalCard: (name) => `[...document.querySelectorAll('[data-slot=window-picker] button[data-slot=general-action-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  confirm: `[...document.querySelectorAll('[data-slot=window-picker] button')].find((b) => b.textContent.trim() === 'Confirm')`,
  buttonText: (name) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(name)}))`,
  // The Nth role card in the picker's target stage (hand + drawn pool).
  targetRoleCardAt: (i) => `[...document.querySelectorAll('[data-slot=window-picker] [data-slot=role-card]')][${String(i)}]`,
  // The first role card in the target stage that is NOT yet selected.
  firstUnselectedTarget: `[...document.querySelectorAll('[data-slot=window-picker] [data-slot=role-card]')].find((b) => b.getAttribute('aria-pressed') !== 'true')`,
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

    // The claim needs Director in the room's role set. Read the default draft's
    // selection straight off the picker.
    const directorPicked = await hostBrowser.page.eval(`(() => {
      const card = [...document.querySelectorAll('[data-role-option]')].find((b) => (b.getAttribute('aria-label') || '').startsWith('Director'));
      return card ? card.getAttribute('aria-pressed') : null;
    })()`);
    const chosenCount = await hostBrowser.page.eval("(document.body.innerText.match(/\\d+ of 5 chosen/) || [null])[0]");
    info(`create page default draft: Director aria-pressed=${JSON.stringify(directorPicked)}; header=${JSON.stringify(chosenCount)}`);
    if (directorPicked !== "true") fail(`Director is not in the default draft (aria-pressed=${JSON.stringify(directorPicked)})`);
    else pass("Director is selected in the default (starter) role set");

    // The seats <select> is a reka-ui Select: it needs a real CDP mouse sequence.
    await hostBrowser.page.clickReal("document.querySelector('#seats')");
    const opened = await hostBrowser.page.waitFor("document.querySelectorAll('[role=option]').length >= 7", { timeoutMs: 4000 });
    if (!opened) throw new Error("the seats select did not open");
    await hostBrowser.page.clickReal(`[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === '2')`);
    const seatsValue = await hostBrowser.page.eval("document.querySelector('#seats')?.textContent.trim()");
    if (seatsValue !== "2") throw new Error(`seats select shows ${JSON.stringify(seatsValue)}, expected "2"`);
    pass("set the room to 2 seats through the reka-ui Select (real CDP pointer)");

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

    const hostBoard = await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    const guestBoard = await guestBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    if (!hostBoard || !guestBoard) throw new Error(`board missing (host ${hostBoard}, guest ${guestBoard})`);
    pass("both seats rendered the game board");

    // The room's live role set: read it off the table puck (each role tile carries its
    // name as a title). The claim needs Director here.
    const roles = await rolesInPlay(hostBrowser.page);
    info(`roles in play: ${JSON.stringify(roles)}`);
    if (!roles.includes("Director")) {
      fail(`Director is not in the room's role set: ${JSON.stringify(roles)}`);
      throw new Error("Director missing; cannot reach the Director keep window");
    }
    pass(`Director is in the room's role set: ${JSON.stringify(roles)}`);

    // Reach the keep window: the active host claims Director, then both seats
    // pass the challenge window, which opens the Director keep window.
    const hostTurn = await hostBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 20000 });
    if (!hostTurn) {
      const body = await dumpBody(hostBrowser.page, "host turn (no picker)");
      throw new Error(`host turn window shows no [data-slot=window-picker]; body: ${body}`);
    }
    pass("host turn window shows [data-slot=window-picker]");
    const turn0 = await turnNumber(hostBrowser.page);
    info(`host turn number before the swap: ${String(turn0)}`);

    const clickedDirector = await hostBrowser.page.clickReal(EL.roleCard("Director"));
    if (!clickedDirector) {
      const body = await dumpBody(hostBrowser.page, "host Director select");
      throw new Error(`host could not select the Director card; body: ${body}`);
    }
    pass("host selected the Director role card (a card-swapping claim)");
    const directorConfirm = await hostBrowser.page.eval(`(() => { const c = ${EL.confirm}; return c ? { disabled: c.disabled } : null; })()`);
    info(`host after Director select: confirm=${JSON.stringify(directorConfirm)}`);
    if (directorConfirm === null || directorConfirm.disabled) fail("Confirm must enable after selecting the Director claim");
    await hostBrowser.page.clickReal(EL.confirm);
    pass("host confirmed the Director claim; the challenge window opens");

    // The rival sees the challenge window (Challenge + Pass); the claimant sees Pass.
    const guestChallenge = await guestBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 15000 });
    if (!guestChallenge) {
      const body = await dumpBody(guestBrowser.page, "guest challenge (no picker)");
      throw new Error(`guest never saw the challenge window; body: ${body}`);
    }
    const guestChallengeTitle = await guestBrowser.page.eval("document.querySelector('[data-slot=window-picker] h2')?.textContent.trim() ?? null");
    pass(`guest challenge window opened: title=${JSON.stringify(guestChallengeTitle)}`);

    // Both seats pass. The rival first.
    const guestPass = await guestBrowser.page.clickReal(EL.generalCard("Pass"));
    if (!guestPass) fail("the guest could not select Pass");
    else pass("guest selected Pass in the challenge window");
    await guestBrowser.page.clickReal(EL.confirm);

    const hostChallenge = await hostBrowser.page.waitFor(`document.querySelector('[data-slot=window-picker] h2')?.textContent.trim() === 'Challenge the claim'`, { timeoutMs: 8000 });
    if (hostChallenge) {
      fail("the claimant still sees a one-card challenge picker; it should be auto-reported");
    } else {
      pass("the claimant's forced Pass is auto-reported; no one-card picker shown");
    }
    pass("both seats passed the challenge; the keep window should now open for the host");

    const keepOpened = await hostBrowser.page.waitFor(
      `(() => { const p = document.querySelector('${EL.picker}'); const t = p?.querySelector('h2')?.textContent.trim() ?? ''; return /^Keep \\d+ cards?$/.test(t); })()`,
      { timeoutMs: 15000 },
    );
    if (!keepOpened) {
      const body = await dumpBody(hostBrowser.page, "host keep window (never opened)");
      throw new Error(`the keep window never opened for the host; body: ${body}`);
    }
    const state0 = await keepState(hostBrowser.page);
    info(`keep window: title=${JSON.stringify(state0.title)} note=${JSON.stringify(state0.note)} keepCard=${JSON.stringify(state0.keepCard)} targetRoleCards=${String(state0.targetRoleCards)} confirm=${JSON.stringify(state0.confirm)}`);
    const titleMatch = /^Keep (\d+) cards?$/.exec(state0.title ?? "");
    if (titleMatch === null) {
      fail(`the keep window title ${JSON.stringify(state0.title)} is not "Keep N cards"`);
      throw new Error("keep title not parseable");
    }
    const N = Number(titleMatch[1]);
    pass(`the keep window renders in [data-slot=window-picker] titled ${JSON.stringify(state0.title)} (N=${String(N)})`);
    if (state0.keepCard === null) fail("the keep window shows no Keep card");
    else pass(`the keep window shows a Keep card (aria-label ${JSON.stringify(state0.keepCard.label)})`);

    const shot1 = await hostBrowser.page.screenshot("01-keep-card");
    console.log(`screenshot: ${shot1}`);

    // Selecting the Keep card opens a target stage of role cards: the hand plus
    // the drawn cards.
    const clickedKeep = await hostBrowser.page.clickReal(EL.generalCard("Keep"));
    if (!clickedKeep) {
      const body = await dumpBody(hostBrowser.page, "keep card select");
      fail(`the Keep card was not clickable; body: ${body}`);
    } else pass("selected the Keep card; its target stage should open");
    const targetShown = await hostBrowser.page.waitFor(`document.querySelectorAll('[data-slot=window-picker] [data-slot=role-card]').length >= ${String(N)}`, { timeoutMs: 6000 });
    const stateTarget = await keepState(hostBrowser.page);
    info(`keep target stage: role-cards=${String(stateTarget.targetRoleCards)} selected=${String(stateTarget.selected)} confirm=${JSON.stringify(stateTarget.confirm)}`);
    if (!targetShown || stateTarget.targetRoleCards < N) {
      const body = await dumpBody(hostBrowser.page, "keep target stage missing");
      fail(`selecting Keep did not open a target stage of role cards; body: ${body}`);
    } else pass(`the target stage shows ${String(stateTarget.targetRoleCards)} [data-slot=role-card] elements (the hand plus the drawn cards)`);

    const shot2 = await hostBrowser.page.screenshot("02-keep-targets");
    console.log(`screenshot: ${shot2}`);

    // Confirm gates on the exact pick count: disabled below N, enabled at N.
    const readAt = async (label) => {
      const s = await keepState(hostBrowser.page);
      info(`pick count ${String(s.selected)} (${label}): Confirm disabled=${JSON.stringify(s.confirm?.disabled)}`);
      return s;
    };
    const atZero = await readAt("0 picks");
    if (atZero.confirm === null || !atZero.confirm.disabled) fail("Confirm must be disabled at 0 picks");
    else pass("Confirm is disabled at 0 picks");

    // Pick up to N-1.
    for (let i = 0; i < N - 1; i++) {
      const clicked = await hostBrowser.page.clickReal(EL.targetRoleCardAt(i));
      if (!clicked) fail(`could not pick target role card #${String(i)}`);
    }
    const atNMinus1 = await readAt(`${String(N - 1)} picks`);
    if (N - 1 === 0) {
      // Nothing to add; the 0-pick read already stands in for N-1.
      info("N-1 equals 0; the 0-pick read is the N-1 read");
    } else if (atNMinus1.confirm === null || !atNMinus1.confirm.disabled) {
      fail(`Confirm must be disabled at ${String(N - 1)} picks (N-1)`);
    } else {
      pass(`Confirm is disabled at ${String(N - 1)} picks (N-1)`);
    }

    // Pick the Nth.
    const clickedNth = await hostBrowser.page.clickReal(EL.targetRoleCardAt(N - 1));
    if (!clickedNth) fail(`could not pick the ${String(N)}th target role card`);
    const atN = await readAt(`${String(N)} picks`);
    if (atN.confirm === null || atN.confirm.disabled) fail(`Confirm must be enabled at exactly ${String(N)} picks`);
    else pass(`Confirm is enabled at exactly ${String(N)} picks`);

    // The target stage enforces the count: a further click on an unselected card
    // must not raise the count past N.
    const unselectedExists = await hostBrowser.page.eval(`!!${EL.firstUnselectedTarget}`);
    if (unselectedExists) {
      const before = (await keepState(hostBrowser.page)).selected;
      const overClicked = await hostBrowser.page.clickReal(EL.firstUnselectedTarget);
      const after = await keepState(hostBrowser.page);
      info(`over-select attempt: clicked an unselected card (${String(overClicked)}); count ${String(before)} -> ${String(after.selected)}; confirm disabled=${JSON.stringify(after.confirm?.disabled)}`);
      if (after.selected !== N) fail(`the target stage let the count pass N: ${String(before)} -> ${String(after.selected)} (N=${String(N)})`);
      else pass(`a further click on an unselected card did not raise the count past N (stayed ${String(after.selected)})`);
    } else {
      info("no unselected target card remained to test over-selection (hand+pool == N)");
    }

    const shotTargets = await hostBrowser.page.screenshot("02b-keep-targets-selected");
    console.log(`screenshot: ${shotTargets}`);

    const keepDump = await pickerDump(hostBrowser.page);
    console.log(`DOM: keep picker children = ${JSON.stringify(keepDump?.children)}`);
    console.log(`DOM: keep picker buttons = ${JSON.stringify(keepDump?.buttons)}`);
    console.log(`DOM: keep picker outerHTML = ${JSON.stringify(keepDump?.outerHTML)}`);

    // Confirm resolves the keep: the picker clears and the turn advances.
    const turnBefore = await turnNumber(hostBrowser.page);
    const confirmed = await hostBrowser.page.clickReal(EL.confirm);
    if (!confirmed) fail("the Confirm button was not clickable");
    else pass("clicked Confirm to resolve the keep");
    const cleared = await hostBrowser.page.waitFor(`!document.querySelector('${EL.picker}')`, { timeoutMs: 12000 });
    const turnAfter = await turnNumber(hostBrowser.page);
    info(`after Confirm: host picker cleared=${String(cleared)}; turn ${String(turnBefore)} -> ${String(turnAfter)}`);
    if (!cleared) {
      const body = await dumpBody(hostBrowser.page, "host after keep Confirm");
      fail(`the host picker did not clear after Confirm; body: ${body}`);
    } else pass("the host's picker cleared after Confirm");
    if (turnBefore !== null && turnAfter !== null && turnAfter !== turnBefore + 1) fail(`turn did not advance by 1: ${String(turnBefore)} -> ${String(turnAfter)}`);
    else if (turnAfter !== null) pass(`turn advanced ${String(turnBefore)} -> ${String(turnAfter)}`);

    const shot3 = await hostBrowser.page.screenshot("03-after-confirm");
    console.log(`screenshot: ${shot3}`);

    // The rival now holds the turn: confirms the swap resolved and the turn moved on.
    const guestTurn = await guestBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 12000 });
    const guestTitle = await guestBrowser.page.eval("document.querySelector('[data-slot=window-picker] h2')?.textContent.trim() ?? null");
    info(`guest picker after the keep: present=${String(guestTurn)} title=${JSON.stringify(guestTitle)}`);

    console.log(`\nRESULT: roles=${JSON.stringify(roles)} keep-title=${JSON.stringify(state0.title)} N=${String(N)} target-role-cards=${String(stateTarget.targetRoleCards)} confirm@0=${JSON.stringify(atZero.confirm)} confirm@N-1=${JSON.stringify(atNMinus1.confirm)} confirm@N=${JSON.stringify(atN.confirm)} turn ${String(turnBefore)}->${String(turnAfter)} cleared=${String(cleared)}`);
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
  console.log("\nall staged keep-window proof checks passed");
}
