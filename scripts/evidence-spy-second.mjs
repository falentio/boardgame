// Captures frontend evidence at the Spy second-action step on the real board.
// Read-only: drives two browsers to the step and records the DOM, the menu the
// page renders from, and screenshots. Writes .audit/proof/spy-second-evidence.json.
//
// Usage: node scripts/evidence-spy-second.mjs [--port 3000] [--keep]
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3000"));
const BASE = `http://localhost:${PORT}`;
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = new URL("../.audit/proof/", import.meta.url).pathname;
const STAMP = Date.now();
const PASSWORD = "proof-password-123";

mkdirSync(OUT, { recursive: true });

const evidence = { capturedAt: new Date().toISOString(), base: BASE, steps: {} };
const info = (msg) => console.log(`INFO: ${msg}`);

// All worktrees share one node_modules/.vite dep cache, so two dev servers
// writing it corrupt the cache and the page stops hydrating. Reuse a server
// that already answers and only spawn one when nothing is listening.
const serverAnswers = async () => {
  try { return (await fetch(`${BASE}/api/auth/ok`)).ok; } catch { return false; }
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
  const email = `spy-evidence-${label}-${STAMP}@example.com`;
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name: label }),
  });
  const body = await res.text();
  if (res.status !== 200) throw new Error(`sign-up ${label} returned ${res.status}: ${body}`);
  const { user } = JSON.parse(body);
  const cookie = res.headers.get("set-cookie");
  const [pair] = cookie.split(";");
  const eq = pair.indexOf("=");
  return { id: user.id, email, name: label, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const launchBrowser = async (label, debugPort) => {
  const profileDir = `/tmp/evidence-spy-${label}-${PORT}-${process.pid}`;
  rmSync(profileDir, { recursive: true, force: true });
  const chrome = spawn(
    "/usr/bin/google-chrome",
    ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
      `--user-data-dir=${profileDir}`, `--remote-debugging-port=${debugPort}`,
      "--remote-allow-origins=*", "about:blank"],
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
    // A busy machine (several worktrees each running a dev server) can take far
    // longer than 30s to hydrate, so wait generously rather than flake.
    async waitForHydration({ timeoutMs = 120000 } = {}) {
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
  createRoleCard: (name) => `[...document.querySelectorAll('[data-role-option][aria-label]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  pickerRoleCard: (name) => `[...document.querySelectorAll('[data-slot=window-picker] button[data-slot=role-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  pickerGeneralCard: (name) => `[...document.querySelectorAll('[data-slot=window-picker] button[data-slot=general-action-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(${JSON.stringify(name)}))`,
  confirm: `[...document.querySelectorAll('[data-slot=window-picker] button')].find((b) => b.textContent.trim() === 'Confirm')`,
  buttonText: (name) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(name)}))`,
};

// The DOM the frontend renders at the current step: title, note, every card with
// its accessible name and disabled reason, and the confirm affordance.
const capturePicker = () => `(() => {
  const picker = document.querySelector('[data-slot=window-picker]');
  if (!picker) return { present: false };
  const cards = [...picker.querySelectorAll('button[data-slot=role-card], button[data-slot=general-action-card], button[data-slot=player-card]')].map((b) => ({
    slot: b.getAttribute('data-slot'),
    label: b.getAttribute('aria-label'),
    disabled: b.disabled,
    selected: b.getAttribute('aria-selected'),
    reason: (b.parentElement?.querySelector(':scope > span')?.textContent ?? '').trim(),
  }));
  const confirm = [...picker.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Confirm');
  return {
    present: true,
    ariaLabel: picker.getAttribute('aria-label'),
    title: picker.querySelector('h2')?.textContent.trim() ?? null,
    note: picker.querySelector('header p')?.textContent.trim() ?? null,
    roleCards: cards.filter((c) => c.slot === 'role-card').map((c) => c.label),
    generalCards: cards.filter((c) => c.slot === 'general-action-card').map((c) => c.label),
    playerCards: cards.filter((c) => c.slot === 'player-card').map((c) => c.label),
    cards,
    confirm: confirm ? { label: confirm.getAttribute('aria-label'), disabled: confirm.disabled } : null,
  };
})()`;

const boardSnapshot = () => `(() => {
  const board = document.querySelector('[data-slot=game-board]');
  if (!board) return { present: false };
  return { present: true, text: board.innerText.replace(/\\n+/g, ' | ') };
})()`;

// Which code the server is serving, so the artifact proves its own provenance
// instead of trusting that whatever answered on the port is this checkout.
const serverProvenance = async () => {
  const source = await fetch(`${BASE}/_nuxt/composables/window-menu.ts`).then((r) => (r.ok ? r.text() : "")).catch(() => "");
  return {
    url: BASE,
    servesSpyMute: source.includes("ONCE_PER_TURN"),
    servesSpyMuteChecked: source.length > 0,
  };
};

const main = async () => {
  const { server, reused } = await startServer();
  evidence.devServerReused = reused;
  evidence.server = await serverProvenance();
  info(`server provenance: ${JSON.stringify(evidence.server)}`);
  const host = await signUp("host");
  const guest = await signUp("guest");
  const hostBrowser = await launchBrowser("host", PORT + 61);
  const guestBrowser = await launchBrowser("guest", PORT + 62);
  try {
    await hostBrowser.page.setViewport(1280, 1000);
    await guestBrowser.page.setViewport(1280, 1000);
    await hostBrowser.page.setSessionCookie(host);
    await guestBrowser.page.setSessionCookie(guest);

    await hostBrowser.page.goto(`${BASE}/rooms/new`);
    await hostBrowser.page.waitForHydration();
    await hostBrowser.page.waitFor("document.querySelectorAll('[data-role-option]').length === 31", { timeoutMs: 15000 });

    // The page re-renders while the session fetch settles, so a rect measured
    // before the click can go stale. Click, then verify the pick stuck.
    const spyPressed = async () => hostBrowser.page.eval(`document.querySelector('[data-role-option][aria-label^="Spy"]')?.getAttribute('aria-pressed') === 'true'`);
    let spyPicked = false;
    for (let attempt = 0; attempt < 6 && !spyPicked; attempt++) {
      await hostBrowser.page.clickReal(EL.createRoleCard("Spy"));
      spyPicked = await spyPressed();
    }
    if (!spyPicked) throw new Error("could not pick Spy on the create page");

    await hostBrowser.page.clickReal("document.querySelector('#seats')");
    await hostBrowser.page.waitFor("document.querySelectorAll('[role=option]').length >= 7", { timeoutMs: 4000 });
    await hostBrowser.page.clickReal(`[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === '2')`);
    await hostBrowser.page.clickReal(EL.buttonText("Create room"));
    const inLobby = await hostBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8}$/.test(location.pathname)", { timeoutMs: 20000 });
    if (!inLobby) throw new Error(`create did not land in the lobby, at ${await hostBrowser.page.url()}`);
    const code = (await hostBrowser.page.url()).replace("/rooms/", "");
    evidence.room = { code, roles: "Spy + starter" };

    await guestBrowser.page.goto(`${BASE}/join/${code}`);
    const guestInLobby = await guestBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8}$/.test(location.pathname)", { timeoutMs: 20000 });
    if (!guestInLobby) throw new Error(`guest did not join; body: ${(await guestBrowser.page.bodyText()).replace(/\n/g, " | ")}`);

    let full = await hostBrowser.page.waitFor("document.body.innerText.includes('All seats filled')", { timeoutMs: 15000 });
    if (!full) {
      await hostBrowser.page.goto(`${BASE}/rooms/${code}`);
      full = await hostBrowser.page.waitFor("document.body.innerText.includes('All seats filled')", { timeoutMs: 15000 });
    }
    if (!full) throw new Error("room never became full");
    await hostBrowser.page.clickReal(EL.buttonText("Start game"));
    const onGame = await hostBrowser.page.waitFor("/^\\/games\\/[A-Z]{8}$/.test(location.pathname)", { timeoutMs: 15000 });
    if (!onGame) throw new Error("Start game did not open the board");
    await guestBrowser.page.goto(`${BASE}/games/${code}`);
    await hostBrowser.page.waitForHydration();
    await guestBrowser.page.waitForHydration();
    await hostBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });
    await guestBrowser.page.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 15000 });

    // Step 1: the host's normal turn window.
    await hostBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 20000 });
    evidence.steps.turn = {
      picker: await hostBrowser.page.eval(capturePicker()),
      board: await hostBrowser.page.eval(boardSnapshot()),
      screenshot: await hostBrowser.page.screenshot("spy-evidence-01-turn"),
    };
    info(`TURN step: title=${JSON.stringify(evidence.steps.turn.picker.title)} roles=${JSON.stringify(evidence.steps.turn.picker.roleCards)} generals=${JSON.stringify(evidence.steps.turn.picker.generalCards)}`);

    // Step 2: claim Spy, let the rival pass, land on the spy-second window.
    const clickedSpy = await hostBrowser.page.clickReal(EL.pickerRoleCard("Spy"));
    if (!clickedSpy) throw new Error("host could not select Spy");
    await hostBrowser.page.clickReal(EL.confirm);

    const guestChallenging = await guestBrowser.page.waitFor(`!!document.querySelector('${EL.picker}')`, { timeoutMs: 15000 });
    if (!guestChallenging) throw new Error(`guest never saw the challenge window; body: ${(await guestBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    evidence.steps.challenge = {
      picker: await guestBrowser.page.eval(capturePicker()),
      screenshot: await guestBrowser.page.screenshot("spy-evidence-02-challenge"),
    };
    info(`CHALLENGE step (guest): title=${JSON.stringify(evidence.steps.challenge.picker.title)} cards=${JSON.stringify(evidence.steps.challenge.picker.cards.map((c) => c.label))}`);

    await guestBrowser.page.clickReal(EL.pickerGeneralCard("Pass"));
    await guestBrowser.page.clickReal(EL.confirm);

    const secondAction = await hostBrowser.page.waitFor(`document.querySelector('[data-slot=window-picker] h2')?.textContent.trim() === 'Second action'`, { timeoutMs: 20000 });
    if (!secondAction) throw new Error(`spy-second window never opened; body: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);

    evidence.steps.spySecond = {
      picker: await hostBrowser.page.eval(capturePicker()),
      board: await hostBrowser.page.eval(boardSnapshot()),
      screenshot: await hostBrowser.page.screenshot("spy-evidence-03-second-action"),
    };
    info(`SPY-SECOND step: title=${JSON.stringify(evidence.steps.spySecond.picker.title)} roles=${JSON.stringify(evidence.steps.spySecond.picker.roleCards)} generals=${JSON.stringify(evidence.steps.spySecond.picker.generalCards)} note=${JSON.stringify(evidence.steps.spySecond.picker.note)}`);

    // What the other seat sees while the Spy holder picks the second action.
    evidence.steps.spySecond.otherSeat = {
      board: await guestBrowser.page.eval(boardSnapshot()),
      picker: await guestBrowser.page.eval(capturePicker()),
      screenshot: await guestBrowser.page.screenshot("spy-evidence-04-other-seat"),
    };
    info(`SPY-SECOND other seat: picker present=${evidence.steps.spySecond.otherSeat.picker.present} board=${JSON.stringify(evidence.steps.spySecond.otherSeat.board.text?.slice(0, 120))}`);

    const path = `${OUT}spy-second-evidence.json`;
    writeFileSync(path, JSON.stringify(evidence, null, 2));
    console.log(`artifact: ${path}`);
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
  console.error(`FAIL: ${error.stack ?? error.message}`);
  process.exitCode = 1;
}
