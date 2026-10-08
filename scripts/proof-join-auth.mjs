// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth
// rejects sign-up with INVALID_ORIGIN.
//
// Usage: node scripts/proof-join-auth.mjs [--port 3001] [--keep]
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3001"));
const KEEP = args.includes("--keep");
const BASE = "http://localhost:" + PORT;
const ROOT = new URL("..", import.meta.url).pathname;
const PROOF = new URL("../.audit/proof/", import.meta.url).pathname;
const STAMP = Date.now();
const PASSWORD = "proof-password-123";
const ROLES = ["banker", "director", "guerrilla", "politician", "peacekeeper"];

const failures = [];
const fail = (m) => { failures.push(m); console.error("FAIL: " + m); };
const pass = (m) => console.log("PASS: " + m);

mkdirSync(PROOF, { recursive: true });

const serverAnswers = async () => {
  try { return (await fetch(BASE + "/api/auth/ok")).ok; } catch { return false; }
};

const startServer = async () => {
  if (await serverAnswers()) return { server: null, reused: true };
  const server = spawn("pnpm", ["exec", "nuxt", "dev", "--port", String(PORT), "--host", "localhost"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" } });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 180; i++) {
    if (await serverAnswers()) return { server, reused: false };
    await delay(1000);
  }
  throw new Error("dev server never became ready:\n" + log);
};

const signUpApi = async (label) => {
  const email = "join-" + label + "-" + STAMP + "@example.com";
  const res = await fetch(BASE + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name: label }),
  });
  const body = await res.text();
  if (res.status !== 200) throw new Error("sign-up " + label + " returned " + res.status + ": " + body);
  const { user } = JSON.parse(body);
  return { id: user.id, email, name: label, cookie: res.headers.get("set-cookie").split(";")[0] };
};

const makeRoom = async (host, name) => {
  const res = await fetch(BASE + "/api/rooms", {
    method: "POST",
    headers: { origin: BASE, cookie: host.cookie, "content-type": "application/json" },
    body: JSON.stringify({ name, seats: 3, roles: ROLES }),
  });
  if (res.status !== 201) throw new Error("create room -> " + res.status + ": " + (await res.text()));
  return (await res.json()).room;
};

const seatedCount = async (code, cookie) => {
  const body = await (await fetch(BASE + "/api/rooms/" + code, { headers: { cookie } })).json();
  return (body.room?.seats ?? []).filter((s) => s.occupant !== null).length;
};

const launch = async (debugPort) => {
  const profileDir = "/tmp/proof-join-auth-" + process.pid + "-" + debugPort;
  rmSync(profileDir, { recursive: true, force: true });
  const chrome = spawn("/usr/bin/google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--user-data-dir=" + profileDir, "--remote-debugging-port=" + debugPort,
    "--remote-allow-origins=*", "about:blank",
  ], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch("http://127.0.0.1:" + debugPort + "/json/version");
      if (res.ok) { wsUrl = (await res.json()).webSocketDebuggerUrl; break; }
    } catch {}
    await delay(250);
  }
  if (!wsUrl) throw new Error("chrome never exposed a debug endpoint");
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}, sessionId) => new Promise((res) => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params, sessionId }));
  });
  const { result: created } = await send("Target.createTarget", { url: "about:blank" });
  const { result: att } = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const s = att.sessionId;
  await send("Page.enable", {}, s);
  await send("Runtime.enable", {}, s);
  await send("Network.enable", {}, s);
  const page = {
    async goto(url) { await send("Page.navigate", { url }, s); await delay(1500); },
    async eval(expr) {
      const { result } = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, s);
      if (result.exceptionDetails) throw new Error("eval failed: " + result.exceptionDetails.text);
      return result.result.value;
    },
    async waitFor(expr, timeoutMs = 20000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        try { if (await page.eval("!!(" + expr + ")")) return true; } catch {}
        await delay(200);
      }
      return false;
    },
    async hydrate(timeoutMs = 30000) {
      return page.waitFor("document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__", timeoutMs);
    },
    async fill(selector, value) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const focused = await page.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (!el) return false; el.focus(); return document.activeElement === el; })()");
        if (!focused) throw new Error("fill: no element for " + selector);
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2 }, s);
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2 }, s);
        await send("Input.insertText", { text: value }, s);
        await delay(200);
        const cur = await page.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); return el ? el.value : null; })()");
        if (cur === value) return;
      }
      throw new Error("fill: value did not stick for " + selector);
    },
    async clickLink(text) {
      const ok = await page.eval("(() => { const a = Array.from(document.querySelectorAll('a')).find((el) => el.textContent.trim() === " + JSON.stringify(text) + "); if (!a) return null; const href = a.getAttribute('href'); a.click(); return href; })()");
      if (ok === null) throw new Error("no link with text " + JSON.stringify(text));
      await delay(1800);
      return ok;
    },
    async submitForm() {
      for (let attempt = 0; attempt < 4; attempt++) {
        await page.eval("(() => { const f = document.querySelector('form'); if (!f) return false; f.requestSubmit ? f.requestSubmit() : f.submit(); return true; })()");
        await delay(2500);
        const path = await page.eval("location.pathname");
        if (!path.startsWith("/login") && !path.startsWith("/signup")) return path;
      }
      return await page.eval("location.pathname");
    },
    async waitForPath(pattern, timeoutMs = 20000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const path = await page.eval("location.pathname");
        if (path === pattern) return path;
        await delay(200);
      }
      return await page.eval("location.pathname");
    },
    async clearCookies() { await send("Network.clearBrowserCookies", {}, s); },
    async path() { return page.eval("location.pathname + location.search"); },
    async screenshot(name) {
      const { result } = await send("Page.captureScreenshot", { format: "png" }, s);
      const path = PROOF + name + ".png";
      writeFileSync(path, Buffer.from(result.data, "base64"));
      return path;
    },
  };
  return { page, close: () => chrome.kill("SIGKILL") };
};

const main = async () => {
  const { server } = await startServer();
  const browser = await launch(PORT + 61);
  try {
    const { page } = browser;

    const hostA = await signUpApi("hostA");
    const roomA = await makeRoom(hostA, "Proof switch-to-signup");
    await page.goto(BASE + "/join/" + roomA.code);
    const landedA = await page.path();
    if (landedA !== "/login?redirect=/join/" + roomA.code) fail("signed-out /join should land on /login?redirect=..., got " + landedA);
    else pass("signed-out /join/" + roomA.code + " -> " + landedA);
    await page.hydrate();
    const hrefA = await page.clickLink("Create an account");
    const afterSwitchA = await page.path();
    if (hrefA !== "/signup?redirect=/join/" + roomA.code) fail("the switch link dropped the destination: href=" + hrefA);
    else pass("the switch link carries the destination: href=" + hrefA);
    if (afterSwitchA !== "/signup?redirect=/join/" + roomA.code) fail("after the switch the URL was " + afterSwitchA);
    else pass("switched to " + afterSwitchA);
    console.log("screenshot: " + await page.screenshot("join-auth-01-signup-switch"));
    await page.hydrate();
    const newEmailA = "join-new-A-" + STAMP + "@example.com";
    if (!(await page.waitFor("document.querySelector('#name') && document.querySelector('#email') && document.querySelector('#password')", 15000))) throw new Error("signup fields never rendered");
    await page.fill("#name", "New Player A");
    await page.fill("#email", newEmailA);
    await page.fill("#password", PASSWORD);
    await page.submitForm();
    const afterSignupA = await page.waitForPath("/rooms/" + roomA.code);
    if (afterSignupA !== "/rooms/" + roomA.code) fail("sign-up after the switch landed on " + afterSignupA + ", want /rooms/" + roomA.code);
    else pass("sign-up after the switch landed on " + afterSignupA);
    const seatsA = await seatedCount(roomA.code, hostA.cookie);
    if (seatsA !== 2) fail("after sign-up the room had " + seatsA + " seats filled, want 2");
    else pass("the room auto-joined: " + seatsA + " of 3 seats filled");
    console.log("screenshot: " + await page.screenshot("join-auth-02-joined"));

    await page.clearCookies();

    const hostB = await signUpApi("hostB");
    const roomB = await makeRoom(hostB, "Proof sign-in");
    const guestB = await signUpApi("guestB");
    await page.goto(BASE + "/join/" + roomB.code);
    await page.hydrate();
    if (!(await page.waitFor("document.querySelector('input[type=email], input#email')", 15000))) throw new Error("login email field never rendered");
    await page.fill("input[type=email], input#email", guestB.email);
    await page.fill("input[type=password], input#password", PASSWORD);
    await page.submitForm();
    const afterLoginB = await page.waitForPath("/rooms/" + roomB.code);
    if (afterLoginB !== "/rooms/" + roomB.code) fail("sign-in landed on " + afterLoginB + ", want /rooms/" + roomB.code);
    else pass("sign-in landed on " + afterLoginB);
    const seatsB = await seatedCount(roomB.code, hostB.cookie);
    if (seatsB !== 2) fail("after sign-in the room had " + seatsB + " seats filled, want 2");
    else pass("the room auto-joined on sign-in: " + seatsB + " of 3");

    await page.clearCookies();

    const hostC = await signUpApi("hostC");
    const roomC = await makeRoom(hostC, "Proof switch-to-login");
    await page.goto(BASE + "/signup?redirect=" + encodeURIComponent("/join/" + roomC.code));
    await page.hydrate();
    const hrefC = await page.clickLink("Sign in");
    const afterSwitchC = await page.path();
    if (hrefC !== "/login?redirect=/join/" + roomC.code) fail("the signup -> login link dropped the destination: href=" + hrefC);
    else pass("the signup -> login link carries the destination: href=" + hrefC);
    if (afterSwitchC !== "/login?redirect=/join/" + roomC.code) fail("after the reverse switch the URL was " + afterSwitchC);
    else pass("reverse switch landed on " + afterSwitchC);

    await page.clearCookies();

    await page.goto(BASE + "/login");
    await page.hydrate();
    const bareHref = await page.eval("(() => { const a = Array.from(document.querySelectorAll('a')).find((el) => el.textContent.trim() === 'Create an account'); return a ? a.getAttribute('href') : null; })()");
    if (bareHref !== "/signup") fail("a bare /login should link to exactly /signup, got " + bareHref);
    else pass("a bare /login still links to exactly /signup");
  } finally {
    browser.close();
    if (server) { server.kill("SIGTERM"); await delay(1500); if (!server.killed) server.kill("SIGKILL"); }
  }
};

try { await main(); } catch (e) { fail(e.stack ?? e.message); }
if (failures.length > 0) { console.error("\n" + failures.length + " check(s) failed"); if (!KEEP) process.exitCode = 1; }
else console.log("\nall join-auth proof checks passed");
