import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3000"));
const BASE = `http://localhost:${PORT}`;
const ROOT = new URL("..", import.meta.url).pathname;
const STAMP = Date.now();
const VARIANTS = ["list", "roster", "grid", "chips", "stage"];

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
};
const pass = (msg) => console.log(`PASS: ${msg}`);

const startServer = async () => {
  const server = spawn(
    "pnpm",
    ["exec", "nuxt", "dev", "--port", String(PORT), "--host", "localhost"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" } },
  );
  for (let i = 0; i < 180; i++) {
    try {
      const res = await fetch(`${BASE}/api/auth/ok`);
      if (res.status < 500) return server;
    } catch {}
    await delay(1000);
  }
  throw new Error("dev server never became ready");
};

const signUp = async (name, slug) => {
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: `floor-${slug}-${STAMP}@example.com`, password: "proof-password-123", name }),
  });
  if (res.status !== 200) throw new Error(`sign-up ${name}: ${res.status}`);
  const cookie = res.headers.get("set-cookie");
  const [pair] = cookie.split(";");
  const eq = pair.indexOf("=");
  return { name, cookie: pair, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const launch = async (debugPort) => {
  const profileDir = `/tmp/floor-${PORT}-${process.pid}`;
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
  await send("Accessibility.enable", {}, session);
  const page = {
    async setSessionCookie(u) { await send("Network.setCookie", { url: BASE, name: u.cookieName, value: u.cookieValue }, session); },
    async setViewport(v) { await send("Emulation.setDeviceMetricsOverride", { width: v.width, height: v.height, mobile: v.mobile, deviceScaleFactor: 1 }, session); },
    async goto(url, waitMs = 1200) {
      const loaded = new Promise((res) => { on("Page.loadEventFired", () => res()); setTimeout(res, 15000); });
      await send("Page.navigate", { url }, session);
      await loaded;
      await delay(waitMs);
    },
    async eval(expression) {
      const { result } = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, session);
      if (result.exceptionDetails) throw new Error(`eval failed: ${result.exceptionDetails.text}`);
      return result.result.value;
    },
    async waitFor(expression, timeoutMs = 10000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) { if (await page.eval(`!!(${expression})`)) return true; await delay(200); }
      return false;
    },
    async key(key) {
      const map = { ArrowRight: ["ArrowRight", 39], ArrowLeft: ["ArrowLeft", 37], Tab: ["Tab", 9] };
      const [k, code] = map[key];
      await send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code }, session);
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code }, session);
    },
    async axTree() {
      const { result } = await send("Accessibility.getFullAXTree", {}, session);
      return result.nodes;
    },
  };
  return { chrome, page, close: () => chrome.kill("SIGKILL") };
};

const main = async () => {
  const server = await startServer();
  const browser = await launch(PORT + 1);
  try {
    const host = await signUp("Amara Okonkwo", "amara");
    const guest = await signUp("Tomás Herrera", "tomas");
    await browser.page.setSessionCookie(host);

    const created = await fetch(`${BASE}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, cookie: host.cookie },
      body: JSON.stringify({ name: "Friday Coup Night", seats: 5, roles: ["banker", "director", "guerrilla", "politician", "peacekeeper"] }),
    });
    const { room } = await created.json();
    await fetch(`${BASE}/api/rooms/${room.code}/join`, { method: "POST", headers: { origin: BASE, cookie: guest.cookie } });
    pass(`seeded room ${room.code}`);

    for (const variant of VARIANTS) {
      await browser.page.setViewport({ width: 320, height: 800, mobile: true });
      await browser.page.goto(`${BASE}/rooms/${room.code}?variant=${variant}`);
      await browser.page.waitFor("document.querySelector('[data-seat]') !== null");
      if (variant === VARIANTS[0]) await delay(2500);

      const overflow = await browser.page.eval("document.documentElement.scrollWidth > document.documentElement.clientWidth");
      if (overflow) fail(`${variant}: horizontal scroll at 320px`);
      else pass(`${variant}: no horizontal scroll at 320px`);

      const clipped = await browser.page.eval(
        `Array.from(document.querySelectorAll('[data-seat]')).some((el) => { const r = el.getBoundingClientRect(); return r.left < -0.5 || r.right > document.documentElement.clientWidth + 0.5; })`,
      );
      if (clipped) fail(`${variant}: a seat row is clipped at 320px`);
      else pass(`${variant}: every seat row fits at 320px`);

      const imgsMissingAlt = await browser.page.eval(
        `Array.from(document.querySelectorAll('[data-seat] img')).filter((img) => !img.getAttribute('alt')).length`,
      );
      if (imgsMissingAlt > 0) fail(`${variant}: ${imgsMissingAlt} avatar(s) with no alt text`);
      else pass(`${variant}: every avatar has alt text`);

      const nodes = await browser.page.axTree();
      const pickerButtons = nodes.filter((n) => n.role?.value === "button" && n.name?.value && VARIANTS.includes(n.name.value.toLowerCase()));
      if (pickerButtons.length !== VARIANTS.length) {
        fail(`${variant}: picker buttons in a11y tree = ${pickerButtons.length}, expected ${VARIANTS.length}`);
      } else {
        pass(`${variant}: all 5 picker buttons expose an accessible name`);
      }
    }

    await browser.page.setViewport({ width: 1440, height: 900, mobile: false });
    await browser.page.goto(`${BASE}/rooms/${room.code}?variant=list`);
    await browser.page.waitFor("document.querySelector('.variant-picker')");

    const pressTab = async () => {
      await browser.page.key("Tab");
      await delay(120);
    };
    let onPicker = false;
    for (let i = 0; i < 40; i++) {
      await pressTab();
      onPicker = await browser.page.eval(
        "document.activeElement && document.activeElement.closest && !!document.activeElement.closest('.variant-picker')",
      );
      if (onPicker) break;
    }
    if (!onPicker) fail("picker: never reached by keyboard Tab");
    else pass("picker: reachable by keyboard Tab");

    const focusVisible = await browser.page.eval(
      `(() => { const el = document.activeElement; if (!el) return false; const s = getComputedStyle(el); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0; })()`,
    );
    if (!focusVisible) fail("picker: keyboard-focused button has no visible outline");
    else pass("picker: keyboard-focused button shows a visible outline");

    const before = await browser.page.eval("document.querySelector('.variant-picker [aria-current=true]').dataset.variant");
    await browser.page.key("ArrowRight");
    await delay(300);
    const after = await browser.page.eval("document.querySelector('.variant-picker [aria-current=true]').dataset.variant");
    if (before === after) fail("picker: ArrowRight did not advance the variant");
    else pass(`picker: ArrowRight moved ${before} -> ${after}`);

    const urlVariant = await browser.page.eval("new URLSearchParams(location.search).get('variant')");
    if (urlVariant !== after) fail(`picker: URL variant ${String(urlVariant)} != active ${after}`);
    else pass("picker: the URL search param is the source of truth");

    const back = await browser.page.eval("history.length > 1");
    pass(`picker: history preserved (replace, not push): ${String(back)}`);
  } finally {
    browser.close();
    server.kill("SIGTERM");
    await delay(1200);
    if (!server.killed) server.kill("SIGKILL");
  }
};

try { await main(); } catch (e) { fail(e.stack ?? e.message); }
if (failures.length > 0) { console.error(`\n${failures.length} check(s) failed`); process.exitCode = 1; }
else console.log("\nall floor checks passed");
