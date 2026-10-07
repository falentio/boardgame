// Live proof of the room-started affordances: the expiry notice, kick with a
// named confirm, leave with its consequence, the host's in-progress panel, and
// the seated non-host redirect.
//
// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth
// rejects the sign-up with INVALID_ORIGIN.
//
// Usage: node scripts/proof-room-started.mjs [--port 3000]
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
const PROOF = new URL("../.audit/proof/", import.meta.url).pathname;
const STAMP = Date.now();
const PASSWORD = "proof-password-123";
const SEATS = 3;
const ROLES = ["banker", "director", "guerrilla", "politician", "peacekeeper"];

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
};
const pass = (msg) => console.log(`PASS: ${msg}`);

mkdirSync(PROOF, { recursive: true });

const serverAnswers = async () => {
  try {
    const res = await fetch(`${BASE}/api/auth/ok`);
    return res.ok;
  } catch {
    return false;
  }
};

const signUp = async (label) => {
  const email = `started-${label}-${STAMP}@example.com`;
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

const launchBrowser = async (label, debugPort) => {
  const profileDir = `/tmp/proof-started-${label}-${PORT}-${process.pid}`;
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
    async clearCookies() {
      await send("Network.clearBrowserCookies", {}, session);
    },
    async goto(url, { waitMs = 1200 } = {}) {
      const loaded = new Promise((res) => {
        on("Page.loadEventFired", () => res());
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

const main = async () => {
  if (!(await serverAnswers())) {
    throw new Error(`no dev server on ${BASE}; start one first`);
  }

  const host = await signUp("host");
  const guest = await signUp("guest");
  const filler = await signUp("filler");

  const createRes = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { origin: BASE, cookie: host.cookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "Started proof", seats: SEATS, roles: ROLES }),
  });
  if (createRes.status !== 201) throw new Error(`create -> ${createRes.status}: ${await createRes.text()}`);
  const { room } = await createRes.json();
  const join = (user) =>
    fetch(`${BASE}/api/rooms/${room.code}/join`, { method: "POST", headers: { origin: BASE, cookie: user.cookie } });
  await join(guest);
  await join(filler);

  const browser = await launchBrowser("host", PORT + 11);
  try {
    const { page } = browser;
    await page.setSessionCookie(host);
    await page.goto(`${BASE}/rooms/${room.code}`);
    await page.waitForHydration();

    const expiry = await page.eval(
      `(() => { const t = document.querySelector("time"); if (!t) return null; const sr = t.parentElement.querySelector(".sr-only"); return { text: t.textContent.trim(), datetime: t.getAttribute("datetime"), absolute: sr ? sr.textContent.trim() : "" }; })()`,
    );
    if (expiry === null) fail("no expiry <time> element rendered");
    else if (!expiry.datetime || !expiry.absolute) fail(`expiry notice lacks datetime/absolute text: ${JSON.stringify(expiry)}`);
    else pass(`expiry notice rendered: "${expiry.text}" (${expiry.absolute})`);
    console.log(`screenshot: ${await page.screenshot("started-01-expiry")}`);

    const kickLabels = await page.eval(
      `[...document.querySelectorAll('button[aria-label^="Kick"]')].map((b) => b.getAttribute("aria-label"))`,
    );
    if (!Array.isArray(kickLabels) || kickLabels.length !== 2) {
      fail(`expected 2 named kick controls, got ${JSON.stringify(kickLabels)}`);
    } else {
      pass(`kick controls present with names: ${kickLabels.join(", ")}`);
    }

    await page.clickUntil(
      `button[aria-label="Kick guest"]`,
      `document.querySelector('[data-slot="alert-dialog-title"]')`,
    );
    const kickTitle = await page.eval(`(document.querySelector('[data-slot="alert-dialog-title"]')?.textContent ?? "").trim()`);
    if (!/remove guest/i.test(kickTitle)) fail(`kick dialog title was "${kickTitle}"`);
    else pass(`kick dialog names the target: "${kickTitle}"`);
    console.log(`screenshot: ${await page.screenshot("started-02-kick-dialog")}`);

    await page.clickUntil(
      `[data-slot="alert-dialog-footer"] button:nth-of-type(2)`,
      `!document.querySelector('[data-slot="alert-dialog-title"]')`,
    );
    const seatText = await page.eval(
      `[...document.querySelectorAll('[data-seat]')].map((el) => el.textContent.trim()).join(" | ")`,
    );
    if (/guest/i.test(seatText)) fail(`kick did not free the guest's seat: ${seatText}`);
    else pass("kick freed the guest's seat");
    console.log(`screenshot: ${await page.screenshot("started-03-after-kick")}`);

    const leaveClicked = await page.clickUntil(
      `button[data-leave-room]`,
      `document.querySelector('[data-slot="alert-dialog-description"]')`,
    );
    if (!leaveClicked) fail("the Leave room control did not open a dialog");
    else {
      const leaveCopy = await page.eval(
        `(document.querySelector('[data-slot="alert-dialog-description"]')?.textContent ?? "").trim()`,
      );
      if (!/host moves/i.test(leaveCopy)) fail(`leave dialog copy was "${leaveCopy}"`);
      else pass(`leave dialog states the consequence: "${leaveCopy}"`);
      console.log(`screenshot: ${await page.screenshot("started-04-leave-dialog")}`);
      await page.clickUntil(
        `[data-slot="alert-dialog-footer"] button:nth-of-type(1)`,
        `!document.querySelector('[data-slot="alert-dialog-description"]')`,
      );
    }

    await join(guest);
    const startRes = await fetch(`${BASE}/api/rooms/${room.code}/start`, {
      method: "POST",
      headers: { origin: BASE, cookie: host.cookie },
    });
    if (startRes.status !== 200) fail(`start -> ${startRes.status}: ${await startRes.text()}`);
    await page.goto(`${BASE}/rooms/${room.code}`);
    await page.waitForHydration();
    const hostBody = await page.bodyText();
    if (!/game in progress/i.test(hostBody)) fail("the host did not see the Game in progress panel");
    else pass("the host sees the Game in progress panel");
    console.log(`screenshot: ${await page.screenshot("started-05-host-in-progress")}`);

    await page.clearCookies();
    await page.setSessionCookie(guest);
    await page.goto(`${BASE}/rooms/${room.code}`);
    const redirected = await page.waitFor(`/^\\/games\\/[A-Z]{8}$/.test(location.pathname)`, { timeoutMs: 15000 });
    const path = await page.url();
    if (!redirected || !path.startsWith(`/games/${room.code}`)) {
      fail(`a seated non-host landed on ${path}, want /games/${room.code}`);
    } else {
      pass(`a seated non-host was redirected to ${path}`);
    }
    console.log(`screenshot: ${await page.screenshot("started-06-redirect")}`);

    const late = await join(filler);
    if (late.status !== 409) fail(`a late join after start -> ${late.status}, want 409`);
    else pass("a late join after start is refused with 409");

    const leaveAfterStart = await fetch(`${BASE}/api/rooms/${room.code}/leave`, {
      method: "POST",
      headers: { origin: BASE, cookie: guest.cookie },
    });
    if (leaveAfterStart.status !== 409) fail(`leave after start -> ${leaveAfterStart.status}, want 409`);
    else pass("leave after start is refused with 409");

    const kickAfterStart = await fetch(`${BASE}/api/rooms/${room.code}/kick`, {
      method: "POST",
      headers: { origin: BASE, cookie: host.cookie, "content-type": "application/json" },
      body: JSON.stringify({ user: guest.id }),
    });
    if (kickAfterStart.status !== 409) fail(`kick after start -> ${kickAfterStart.status}, want 409`);
    else pass("kick after start is refused with 409");

    await page.clearCookies();
    await page.setSessionCookie(host);
    await page.goto(`${BASE}/rooms/${room.code}`);
    await page.waitForHydration();
    const hostControls = await page.eval(`({
      leave: !!document.querySelector("[data-leave-room]"),
      kick: document.querySelectorAll('button[aria-label^="Kick"]').length,
    })`);
    if (hostControls.leave || hostControls.kick > 0) {
      fail(`the started lobby still offers mutations: ${JSON.stringify(hostControls)}`);
    } else {
      pass("the started lobby offers neither Leave nor Kick");
    }
  } finally {
    browser.close();
  }

  if (failures.length > 0) {
    console.error(`\n${String(failures.length)} check(s) failed`);
    process.exitCode = 1;
  } else {
    console.log("\nall room-started proof checks passed");
  }
};

try {
  await main();
} catch (error) {
  fail(error.stack ?? error.message);
  process.exitCode = 1;
}
