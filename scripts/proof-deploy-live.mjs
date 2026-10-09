// Drives the deployed app in headless Chrome over CDP and asserts a real
// browser sign-up. The browser sends an Origin header, so this exercises
// better-auth's origin check against the live worker, which a curl POST skips.
//
// Usage: node scripts/proof-deploy-live.mjs [--base https://boardgame.falent.workers.dev] [--keep]
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const BASE = argOf("--base", "https://boardgame.falent.workers.dev");
const KEEP = args.includes("--keep");
const PROOF = new URL("../.audit/proof/", import.meta.url).pathname;
const NAME = "Live Deploy Proof";
const EMAIL = `live-proof+${Date.now()}@example.com`;
const PASSWORD = "live-proof-password-123";
const DEBUG_PORT = 9333;

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
};
const pass = (msg) => console.log(`PASS: ${msg}`);

mkdirSync(PROOF, { recursive: true });

const connectBrowser = async () => {
  const profileDir = `/tmp/proof-live-profile-${process.pid}`;
  rmSync(profileDir, { recursive: true, force: true });
  const chrome = spawn(
    "/usr/bin/google-chrome",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${DEBUG_PORT}`,
      "--remote-allow-origins=*",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  let wsUrl = null;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) {
        wsUrl = (await res.json()).webSocketDebuggerUrl;
        break;
      }
    } catch {}
    await delay(250);
  }
  if (!wsUrl) throw new Error("chrome never exposed a debug endpoint");

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
    async goto(url, { waitMs = 1500 } = {}) {
      const loaded = new Promise((res) => {
        on("Page.loadEventFired", () => res());
        setTimeout(res, 20000);
      });
      await send("Page.navigate", { url }, session);
      await loaded;
      await delay(waitMs);
    },
    async eval(expression) {
      const { result } = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, session);
      if (result.exceptionDetails) throw new Error(`eval failed: ${result.exceptionDetails.text}`);
      return result.result.value;
    },
    async path() {
      return page.eval("location.pathname");
    },
    async fill(selector, value) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const focused = await page.eval(
          `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus(); return document.activeElement === el; })()`,
        );
        if (!focused) throw new Error(`fill: no element for ${selector}`);
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2 }, session);
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2 }, session);
        await send("Input.insertText", { text: value }, session);
        await delay(200);
        const current = await page.eval(
          `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.value : null; })()`,
        );
        if (current === value) return;
      }
      throw new Error(`fill: value did not stick for ${selector}`);
    },
    async bodyText() {
      return page.eval("document.body.innerText");
    },
    async waitFor(expression, { timeoutMs = 10000 } = {}) {
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
  const browser = await connectBrowser();
  try {
    await browser.page.goto(`${BASE}/`);
    const signedOut = await browser.page.path();
    if (signedOut !== "/login") fail(`signed-out / should land on /login, got ${signedOut}`);
    else pass("signed-out visit to / redirected to /login");
    console.log(`screenshot: ${await browser.page.screenshot("deploy-01-login")}`);

    await browser.page.goto(`${BASE}/signup`);
    await browser.page.waitForHydration();
    const ready = await browser.page.waitFor(
      "document.querySelector('#name') && document.querySelector('#email') && document.querySelector('#password')",
      { timeoutMs: 15000 },
    );
    if (!ready) fail("the signup page did not render its fields");
    else pass("the signup page rendered the name, email, and password fields");

    let filled = false;
    for (let attempt = 0; attempt < 6 && !filled; attempt++) {
      await browser.page.fill("#name", NAME);
      await browser.page.fill("#email", EMAIL);
      await browser.page.fill("#password", PASSWORD);
      filled = await browser.page.eval(
        `(() => { const n = document.querySelector('#name'); const e = document.querySelector('#email'); const p = document.querySelector('#password'); return !!n && !!e && !!p && n.value === ${JSON.stringify(NAME)} && e.value === ${JSON.stringify(EMAIL)} && p.value === ${JSON.stringify(PASSWORD)}; })()`,
      );
    }
    if (!filled) fail("signup fields would not hold the typed values");
    console.log(`screenshot: ${await browser.page.screenshot("deploy-02-signup")}`);

    await browser.page.eval(
      "(() => { const f = document.querySelector('form'); if (!f) return false; f.requestSubmit ? f.requestSubmit() : f.submit(); return true; })()",
    );
    const landed = await browser.page.waitFor("location.pathname === '/'", { timeoutMs: 30000 });
    if (!landed) fail(`browser sign-up did not land on /, still at ${await browser.page.path()}`);
    else pass("the browser sign-up created the account and landed on /");

    const body = await browser.page.bodyText();
    if (!body.includes(EMAIL)) fail(`the shell does not show ${EMAIL}`);
    else pass(`the shell shows the new account email ${EMAIL}`);
    console.log(`screenshot: ${await browser.page.screenshot("deploy-03-signed-in")}`);
    console.log(`created ${EMAIL}`);
  } finally {
    browser.close();
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
  console.log("\nall live deploy proof checks passed");
}
