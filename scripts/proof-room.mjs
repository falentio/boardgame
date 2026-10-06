// Live proof of the room flow: create, shared-link join, and the lobby.
//
// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth
// rejects the sign-up with INVALID_ORIGIN.
//
// Usage: node scripts/proof-room.mjs [--port 3000] [--keep]
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
const SEATS = 5;

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
};
const pass = (msg) => console.log(`PASS: ${msg}`);

mkdirSync(PROOF, { recursive: true });

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
  const email = `room-${label}-${STAMP}@example.com`;
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
  return { id: user.id, email, name: label, cookie: pair, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const joinAs = async (user, code) => {
  const res = await fetch(`${BASE}/api/rooms/${code}/join`, {
    method: "POST",
    headers: { origin: BASE, cookie: user.cookie },
  });
  if (res.status !== 200) throw new Error(`join ${user.email} returned ${res.status}: ${await res.text()}`);
};

const launchBrowser = async (label, debugPort) => {
  const profileDir = `/tmp/proof-room-${label}-${PORT}-${process.pid}`;
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
      if (res.ok) {
        wsUrl = (await res.json()).webSocketDebuggerUrl;
        break;
      }
    } catch {}
    await delay(250);
  }
  if (!wsUrl) throw new Error(`${label}: chrome never exposed a debug endpoint`);

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    } else if (m.method && listeners.has(m.method)) {
      for (const fn of listeners.get(m.method)) fn(m.params);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });
  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, []);
    listeners.get(method).push(fn);
  };

  const { result: created } = await send("Target.createTarget", { url: "about:blank" });
  const { result: attached } = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const session = attached.sessionId;
  await send("Page.enable", {}, session);
  await send("Runtime.enable", {}, session);
  await send("Network.enable", {}, session);

  const page = {
    async setSessionCookie(user) {
      await send("Network.setCookie", { url: BASE, name: user.cookieName, value: user.cookieValue }, session);
    },
    async goto(url, { waitMs = 1200 } = {}) {
      const loaded = new Promise((res) => {
        const fn = () => res();
        on("Page.loadEventFired", fn);
        setTimeout(res, 15000);
      });
      await send("Page.navigate", { url }, session);
      await loaded;
      await delay(waitMs);
    },
    async eval(expression) {
      const { result } = await send(
        "Runtime.evaluate",
        { expression, returnByValue: true, awaitPromise: true },
        session,
      );
      if (result.exceptionDetails) throw new Error(`eval failed: ${result.exceptionDetails.text}`);
      return result.result.value;
    },
    async url() {
      return page.eval("location.pathname");
    },
    async bodyText() {
      return page.eval("document.body.innerText");
    },
    async waitFor(expression, { timeoutMs = 8000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await page.eval(`!!(${expression})`)) return true;
        await delay(200);
      }
      return false;
    },
    async waitForHydration({ timeoutMs = 30000 } = {}) {
      const ok = await page.waitFor(
        "document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__",
        { timeoutMs },
      );
      if (!ok) throw new Error("Vue never hydrated");
      return true;
    },
    // A hydration marker appears before a control's listener is live, so the
    // first click can be dropped; retry until the effect shows. A previous
    // click may already have removed the element, so an effect check first
    // distinguishes "already done" from "nothing to click".
    async clickUntil(selector, effect, { attempts = 8 } = {}) {
      const effectMet = () => page.eval(`!!(${effect})`);
      for (let i = 0; i < attempts; i++) {
        if (await effectMet()) return true;
        const ok = await page.eval(
          `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`,
        );
        if (!ok) {
          if (await effectMet()) return true;
          throw new Error(`clickUntil: no element for ${selector}`);
        }
        for (let wait = 0; wait < 6; wait++) {
          if (await effectMet()) return true;
          await delay(200);
        }
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

const buttonByText = (text) =>
  `Array.from(document.querySelectorAll('button')).find((b) => b.textContent.trim().includes(${JSON.stringify(text)}))`;

const buttonDisabled = (text) =>
  `(() => { const b = ${buttonByText(text)}; return b ? b.disabled : null; })()`;

const clickButton = (text) =>
  `(() => { const b = ${buttonByText(text)}; if (!b) return false; b.click(); return true; })()`;

const main = async () => {
  const { server, reused } = await startServer();
  if (reused) console.warn("note: reusing an already-running dev server; not validated as this checkout");
  const hostBrowser = await launchBrowser("host", PORT + 1);
  const guestBrowser = await launchBrowser("guest", PORT + 2);
  try {
    const host = await signUp("host");
    const guest = await signUp("guest");
    const fillers = [];
    for (let i = 0; i < SEATS - 2; i++) fillers.push(await signUp(`filler${i}`));
    await hostBrowser.page.setSessionCookie(host);
    await guestBrowser.page.setSessionCookie(guest);
    pass(`created the host and ${String(fillers.length + 1)} other accounts`);

    await hostBrowser.page.goto(`${BASE}/rooms/new`);
    await hostBrowser.page.waitForHydration();
    const pickerReady = await hostBrowser.page.waitFor("document.querySelectorAll('[data-role-option]').length === 31");
    if (!pickerReady) fail("the role picker did not render every role");
    else pass("the create page rendered the 31-role picker");

    const starterSelected = await hostBrowser.page.eval(
      "document.querySelectorAll('[data-role-option][aria-pressed=true]').length",
    );
    if (starterSelected !== 5) fail(`expected 5 starter roles selected, got ${starterSelected}`);
    else pass("the picker opened with the 5 starter roles selected");
    console.log(`screenshot: ${await hostBrowser.page.screenshot("04-create")}`);

    const banker = `document.querySelector('[data-role-option][aria-label^="Banker"]')`;
    const selectedCount = "document.querySelectorAll('[data-role-option][aria-pressed=true]').length";

    await hostBrowser.page.clickUntil(
      `[data-role-option]`,
      `${selectedCount} === 4`,
    );
    const deselected = await hostBrowser.page.waitFor(
      "document.body.innerText.includes('Still to choose: 1 Finance')",
      { timeoutMs: 5000 },
    );
    if (!deselected) {
      fail(`deselecting a Finance role should leave it incomplete, got: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass("deselecting the Finance role reports it as still to choose");
    }

    await hostBrowser.page.eval(
      `(() => { const b = ${banker}; if (b) b.click(); return true; })()`,
    );
    const restored = await hostBrowser.page.waitFor(`${selectedCount} === 5`, { timeoutMs: 5000 });
    if (!restored) fail(`re-selecting the Finance role should restore 5 selected, got ${await hostBrowser.page.eval(selectedCount)}`);
    else pass("re-selecting the Finance role restores a complete set");

    const noDisabled = await hostBrowser.page.eval(
      "document.querySelectorAll('[data-role-option][disabled]').length",
    );
    if (noDisabled > 0) fail(`${noDisabled} role card(s) are disabled, every role must stay pickable`);
    else pass("no role card is disabled while the draft is complete");

    await hostBrowser.page.clickUntil(
      `[data-role-option][aria-label^="Capitalist"]`,
      `document.querySelector('[data-role-option][aria-label^="Capitalist"]')?.getAttribute('aria-pressed') === 'true'`,
    );
    const bankerGone = await hostBrowser.page.eval(
      `document.querySelector('[data-role-option][aria-label^="Banker"]')?.getAttribute('aria-pressed') === 'false'`,
    );
    const stillFive = await hostBrowser.page.eval(selectedCount);
    if (!bankerGone) fail("replacing Banker with Capitalist should deselect Banker in the same click");
    else if (stillFive !== 5) fail(`a replacement should keep 5 selected, got ${stillFive}`);
    else pass("one click replaces a filled Finance slot (Capitalist for Banker)");

    await hostBrowser.page.eval(
      `(() => { const b = ${banker}; if (b) b.click(); return true; })()`,
    );
    const backToBanker = await hostBrowser.page.waitFor(`${selectedCount} === 5 && !!${banker}`, { timeoutMs: 5000 });
    if (!backToBanker) fail("could not restore the starter Finance role before submitting");

    await hostBrowser.page.clickUntil("button[type=submit]", "/^\\/rooms\\/[A-Z]{8}$/.test(location.pathname)");
    const inLobby = await hostBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8}$/.test(location.pathname)", {
      timeoutMs: 20000,
    });
    if (!inLobby) fail(`create did not navigate to the lobby, at ${await hostBrowser.page.url()}`);
    const code = (await hostBrowser.page.url()).replace("/rooms/", "");
    if (!/^[A-Z]{8}$/.test(code)) fail(`the lobby URL did not carry an 8-char code: ${code}`);
    else pass(`created the room ${code} and landed in its lobby`);

    await hostBrowser.page.waitForHydration();
    const lobbyRoles = await hostBrowser.page.waitFor(
      "document.querySelectorAll('[data-slot=role-card]').length === 5",
      { timeoutMs: 12000 },
    );
    if (!lobbyRoles) {
      fail(`the lobby should show the 5 chosen roles as role cards, found ${await hostBrowser.page.eval("document.querySelectorAll('[data-slot=role-card]').length")}`);
    } else {
      pass("the lobby shows the 5 chosen roles as role cards");
    }
    const roleStrip = await hostBrowser.page.eval(
      `(() => {
        const strip = document.querySelector('[data-slot=role-strip]');
        if (!strip) return null;
        const cards = [...strip.querySelectorAll('[data-slot=role-card]')];
        const topOf = (el) => el.getBoundingClientRect().top;
        const oneRow = new Set(cards.map(topOf)).size === 1;
        return { scrolls: strip.scrollWidth > strip.clientWidth, oneRow, count: cards.length };
      })()`,
    );
    if (roleStrip === null) fail("the lobby has no role strip");
    else if (roleStrip.count !== 5) fail(`the role strip should hold 5 cards, got ${roleStrip.count}`);
    else if (!roleStrip.oneRow) fail("the role cards should sit on one row, not wrap");
    else if (!roleStrip.scrolls) fail("the role strip should scroll horizontally when the cards exceed its width");
    else pass("the role cards sit on one scrollable row");

    const waitingShown = await hostBrowser.page.waitFor(
      `document.body.innerText.includes('Waiting for ${String(SEATS - 1)} more players')`,
      { timeoutMs: 12000 },
    );
    if (!waitingShown) {
      fail(`the lobby should wait for ${String(SEATS - 1)} more players, got: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass(`the lobby shows it is waiting for ${String(SEATS - 1)} more players`);
    }
    const startDisabled = await hostBrowser.page.eval(buttonDisabled("Start game"));
    if (startDisabled !== true) fail(`Start should be disabled while waiting, got disabled=${startDisabled}`);
    else pass("the host's Start is disabled while the room is not full");
    console.log(`screenshot: ${await hostBrowser.page.screenshot("05-lobby-waiting")}`);

    await guestBrowser.page.goto(`${BASE}/join/${code}`);
    const guestInLobby = await guestBrowser.page.waitFor("/^\\/rooms\\/[A-Z]{8}$/.test(location.pathname)", {
      timeoutMs: 20000,
    });
    if (!guestInLobby) fail(`the guest link did not land in the lobby, at ${await guestBrowser.page.url()}`);
    else pass("the guest's shared link landed in the lobby");
    await guestBrowser.page.waitForHydration();
    const guestLobbyReady = await guestBrowser.page.waitFor(
      "document.body.innerText.includes('Only the host can start the game.')",
      { timeoutMs: 12000 },
    );
    if (!guestLobbyReady) {
      fail(`the guest should see only the host can start, got: ${(await guestBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass("the guest sees only the host can start, no Start control");
    }
    const guestSeated = await guestBrowser.page.waitFor("document.body.innerText.includes('You')", {
      timeoutMs: 12000,
    });
    if (!guestSeated) fail("the guest's seat is not marked as theirs");
    else pass("the guest's seat is marked as theirs");
    console.log(`screenshot: ${await guestBrowser.page.screenshot("07-guest-lobby")}`);

    const liveUpdate = await hostBrowser.page.waitFor(
      `document.body.innerText.includes('Waiting for ${String(SEATS - 2)} more players')`,
      { timeoutMs: 20000 },
    );
    if (!liveUpdate) {
      fail("the host's lobby did not update live after the guest joined");
    } else {
      pass(`the host's lobby updated live to Waiting for ${String(SEATS - 2)} more players`);
    }

    for (const filler of fillers) await joinAs(filler, code);
    pass(`filled the last ${String(fillers.length)} seats`);

    const becameFull = await hostBrowser.page.waitFor(
      "document.body.innerText.includes('All seats filled')",
      { timeoutMs: 20000 },
    );
    if (!becameFull) {
      fail("the host's lobby did not update to full after the last seat filled");
    } else {
      pass("the host's lobby updated live to All seats filled");
    }
    const startEnabled = await hostBrowser.page.eval(buttonDisabled("Start game"));
    if (startEnabled !== false) fail(`Start should be enabled once full, got disabled=${startEnabled}`);
    else pass("the host's Start is enabled once the room is full");

    const hostSeatAvatar = await hostBrowser.page.eval(
      `(() => { const row = document.querySelector('[data-seat="0"]'); const img = row ? row.querySelector('img') : null; return img ? img.getAttribute('src') : null; })()`,
    );
    if (!hostSeatAvatar || !hostSeatAvatar.includes(`seed=${host.id}`)) {
      fail(`the host's seat should show an identity avatar seeded by their id, got ${String(hostSeatAvatar)}`);
    } else {
      pass("the host's seat shows an identity-derived avatar");
    }
    const seatsShowNames = await hostBrowser.page.waitFor(
      `document.body.innerText.includes(${JSON.stringify(host.name)}) && document.body.innerText.includes(${JSON.stringify(guest.name)})`,
      { timeoutMs: 8000 },
    );
    if (!seatsShowNames) {
      fail(`the lobby should show the seated players' names, got: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass("the lobby shows each seated player's display name");
    }
    console.log(`screenshot: ${await hostBrowser.page.screenshot("06-lobby-full")}`);

    await hostBrowser.page.eval(clickButton("Start game"));
    const seamShown = await hostBrowser.page.waitFor(
      "document.body.innerText.includes('Starting the game is not wired up yet.')",
      { timeoutMs: 8000 },
    );
    if (!seamShown) {
      fail(`clicking Start should report the seam, got: ${(await hostBrowser.page.bodyText()).replace(/\n/g, " | ")}`);
    } else {
      pass("clicking Start reports the game start is not wired up yet");
    }
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
  console.log("\nall room proof checks passed");
}
