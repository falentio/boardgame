// Drives the real app in headless Chrome over CDP and asserts the auth flow.
// Boots `nuxt dev`, creates a user through the API, then proves: a signed-out
// visit to / lands on /login, the login form signs in, and the sidebar shell
// shows the signed-in user's email. Screenshots land in .audit/proof/.
//
// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth
// rejects the sign-up with INVALID_ORIGIN.
//
// Usage: node scripts/proof-ui.mjs [--port 3000] [--keep]
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
const EMAIL = `proof+${Date.now()}@example.com`;
const PASSWORD = "proof-password-123";
const NAME = "Proof User";

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
};
const pass = (msg) => console.log(`PASS: ${msg}`);

mkdirSync(PROOF, { recursive: true });

// A reused profile carries the session cookie from a prior run, so the
// signed-out assertion would see a still-signed-in browser. Start clean.
const profileDir = `/tmp/proof-profile-${PORT}-${process.pid}`;
rmSync(profileDir, { recursive: true, force: true });

const startServer = async () => {
  const server = spawn(
    "pnpm",
    ["exec", "nuxt", "dev", "--port", String(PORT), "--host", "localhost"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" } },
  );
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 180; i++) {
    try {
      const res = await fetch(`${BASE}/api/auth/ok`);
      if (res.status < 500) return { server, log: () => log };
    } catch {}
    await delay(1000);
  }
  throw new Error(`dev server never became ready:\n${log}`);
};

const connectBrowser = async () => {
  const debugPort = PORT + 1;
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

  const page = {
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
    async click(selector) {
      const ok = await page.eval(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`,
      );
      if (!ok) throw new Error(`click: no element for ${selector}`);
      await delay(600);
    },
    // Set the value the way a person does. A synthetic `value` set is reverted
    // by Vue's next patch of the controlled input, so type through CDP instead.
    // The session fetch can re-render the form mid-type and clear the field, so
    // confirm the value stuck and retype if it did not.
    async fill(selector, value) {
      for (let attempt = 0; attempt < 5; attempt++) {
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
    async text(selector) {
      return page.eval(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.textContent.trim() : null; })()`,
      );
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
    // A dev server hydrates Vue several seconds after the first paint. Filling
    // or submitting before then fires the native form action instead of the
    // Vue handler, because @submit is not bound yet. Wait for the marker.
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
  const { server } = await startServer();
  const browser = await connectBrowser();
  try {
    const signUp = await fetch(`${BASE}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: NAME }),
    });
    if (signUp.status !== 200) {
      fail(`sign-up returned ${signUp.status}: ${await signUp.text()}`);
      return;
    }
    pass(`created the proof user ${EMAIL}`);

    await browser.page.goto(`${BASE}/`);
    const signedOutPath = await browser.page.url();
    if (signedOutPath !== "/login") {
      fail(`signed-out / should redirect to /login, landed on ${signedOutPath}`);
    } else {
      pass("signed-out visit to / redirected to /login");
    }
    console.log(`screenshot: ${await browser.page.screenshot("01-login")}`);

    await browser.page.waitForHydration();
    const emailInput = await browser.page.waitFor("document.querySelector('input[type=email], input#email')");
    if (!emailInput) {
      fail("login page has no email input");
    } else {
      await browser.page.fill("input[type=email], input#email", EMAIL);
      await browser.page.fill("input[type=password], input#password", PASSWORD);
      await browser.page.eval(
        `(() => { const f = document.querySelector('form'); if (!f) return false; f.requestSubmit ? f.requestSubmit() : f.submit(); return true; })()`,
      );
      const landed = await browser.page.waitFor("location.pathname === '/'", { timeoutMs: 30000 });
      if (!landed) fail(`login did not land on /, still at ${await browser.page.url()}`);
      else pass("login form signed in and landed on /");
    }

    const shellShown = await browser.page.waitFor(
      "!!document.querySelector('[data-slot=sidebar-wrapper], [data-sidebar], aside')",
      { timeoutMs: 8000 },
    );
    if (!shellShown) fail("sidebar shell did not render after login");
    else pass("sidebar shell rendered");

    const body = await browser.page.bodyText();
    if (!body.includes(EMAIL)) fail(`shell body does not show the session email ${EMAIL}`);
    else pass(`shell shows the session email ${EMAIL}`);

    console.log(`screenshot: ${await browser.page.screenshot("02-shell")}`);

    const collapsed = await browser.page.eval(
      `(() => { const t = document.querySelector('[data-slot=sidebar-trigger], [data-sidebar=trigger], button[aria-label*="sidebar" i], button[aria-label*="toggle" i]'); if (!t) return false; t.click(); return true; })()`,
    );
    if (collapsed) {
      await delay(800);
      console.log(`screenshot: ${await browser.page.screenshot("03-shell-collapsed")}`);
    }
  } finally {
    browser.close();
    server.kill("SIGTERM");
    await delay(1500);
    if (!server.killed) server.kill("SIGKILL");
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
  console.log("\nall UI proof checks passed");
}
