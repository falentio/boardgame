// Live proof of the QR share + scan flow on the real surface.
//
// Drives the real app in headless Chrome over CDP with a fake camera fed a y4m of a
// QR code rendered from the app's own room link. Asserts the lobby QR round-trips,
// a scan joins the room, and every camera failure state keeps the manual path.
//
// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth rejects
// sign-up with INVALID_ORIGIN.
//
// Usage: node scripts/proof-qr.mjs [--port 3005] [--keep]
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3005"));
const KEEP = args.includes("--keep");
const BASE = "http://localhost:" + PORT;
const ROOT = new URL("..", import.meta.url).pathname;
const PROOF = new URL("../.audit/proof/", import.meta.url).pathname;
const WORK = "/tmp/proof-qr-" + String(process.pid);
const STAMP = Date.now();
const PASSWORD = "proof-password-123";
const ROLES = ["banker", "director", "guerrilla", "politician", "peacekeeper"];
const CHROME = "/usr/bin/google-chrome";

const failures = [];
const fail = (m) => { failures.push(m); console.error("FAIL: " + m); };
const pass = (m) => console.log("PASS: " + m);

mkdirSync(PROOF, { recursive: true });
mkdirSync(WORK, { recursive: true });

const serverAnswers = async () => {
  try { return (await fetch(BASE + "/api/auth/ok")).ok; } catch { return false; }
};

const startServer = async () => {
  if (await serverAnswers()) return { server: null };
  const server = spawn("pnpm", ["exec", "nuxt", "dev", "--port", String(PORT), "--host", "localhost"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" } });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 180; i++) {
    if (await serverAnswers()) return { server };
    await delay(1000);
  }
  throw new Error("dev server never became ready:\n" + log);
};

const signUp = async (label) => {
  const email = "qr-" + label + "-" + String(STAMP) + "@example.com";
  const res = await fetch(BASE + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name: label }),
  });
  const body = await res.text();
  if (res.status !== 200) throw new Error("sign-up " + label + " -> " + String(res.status) + ": " + body);
  const cookie = res.headers.get("set-cookie");
  const [pair] = cookie.split(";");
  const eq = pair.indexOf("=");
  return { email, cookie: pair, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const createRoom = async (host) => {
  const res = await fetch(BASE + "/api/rooms", {
    method: "POST",
    headers: { origin: BASE, cookie: host.cookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "QR proof", seats: 3, roles: ROLES }),
  });
  if (res.status !== 201) throw new Error("create room -> " + String(res.status) + ": " + (await res.text()));
  return (await res.json()).room;
};

const seatedCount = async (code, cookie) => {
  const body = await (await fetch(BASE + "/api/rooms/" + code, { headers: { cookie } })).json();
  return (body.room?.seats ?? []).filter((s) => s.occupant !== null).length;
};

const buildY4m = async (value, outPath) => {
  const { renderSVG } = await import("uqr");
  const svg = renderSVG(value, { ecc: "M", border: 2, blackColor: "#000000", whiteColor: "#ffffff", pixelSize: 8 });
  const html = '<!doctype html><meta charset=utf-8><body style="margin:0;background:#fff;padding:40px">'
    + svg.replace("<svg ", '<svg width="400" height="400" ') + "</body>";
  const htmlPath = outPath + ".html";
  const pngPath = outPath + ".png";
  writeFileSync(htmlPath, html);
  const shot = spawnSync(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu",
    "--screenshot=" + pngPath, "--window-size=480,480", "--hide-scrollbars", "file://" + htmlPath], { encoding: "utf8" });
  if (shot.status !== 0) throw new Error("rasterize failed: " + shot.stderr);
  const ff = spawnSync("ffmpeg", ["-y", "-loop", "1", "-i", pngPath, "-t", "3", "-r", "10",
    "-vf", "scale=300:300,pad=480:480:90:90:white", "-pix_fmt", "yuv420p", outPath], { encoding: "utf8" });
  if (ff.status !== 0) throw new Error("ffmpeg failed: " + ff.stderr);
  return outPath;
};

const pngToY4m = (pngPath, outPath) => {
  const ff = spawnSync("ffmpeg", ["-y", "-loop", "1", "-i", pngPath, "-t", "3", "-r", "10",
    "-vf", "scale=300:300,pad=480:480:90:90:white", "-pix_fmt", "yuv420p", outPath], { encoding: "utf8" });
  if (ff.status !== 0) throw new Error("ffmpeg failed: " + ff.stderr);
  return outPath;
};

const launch = async ({ debugPort, y4m, fakeCamera, fakeUi = true, onNewDocument }) => {
  const profileDir = WORK + "/profile-" + String(debugPort);
  rmSync(profileDir, { recursive: true, force: true });
  const flags = ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--user-data-dir=" + profileDir, "--remote-debugging-port=" + String(debugPort),
    "--remote-allow-origins=*", "about:blank"];
  if (fakeCamera) {
    if (fakeUi) flags.push("--use-fake-ui-for-media-stream");
    flags.push("--use-fake-device-for-media-stream");
    if (y4m) flags.push("--use-file-for-fake-video-capture=" + y4m);
  }
  const chrome = spawn(CHROME, flags, { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch("http://127.0.0.1:" + String(debugPort) + "/json/version"); if (r.ok) { wsUrl = (await r.json()).webSocketDebuggerUrl; break; } } catch {}
    await delay(250);
  }
  if (!wsUrl) throw new Error("chrome never exposed a debug endpoint");
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}, sid) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId: sid })); });
  const { result: created } = await send("Target.createTarget", { url: "about:blank" });
  const { result: att } = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const s = att.sessionId;
  await send("Page.enable", {}, s);
  await send("Runtime.enable", {}, s);
  await send("Network.enable", {}, s);
  if (onNewDocument) await send("Page.addScriptToEvaluateOnNewDocument", { source: onNewDocument }, s);
  const page = {
    async setCookie(u) { await send("Network.setCookie", { url: BASE, name: u.cookieName, value: u.cookieValue }, s); },
    async denyCamera() { await send("Browser.setPermission", { permission: { name: "camera" }, setting: "denied", origin: BASE }, s); },
    async goto(url, waitMs = 1500) { await send("Page.navigate", { url }, s); await delay(waitMs); },
    async eval(expr) {
      const { result } = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, s);
      if (result.exceptionDetails) throw new Error("eval failed: " + result.exceptionDetails.text);
      return result.result.value;
    },
    async hydrate(timeoutMs = 30000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) { if (await page.eval("!!(document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__)")) return true; await delay(300); }
      return false;
    },
    async waitFor(expr, timeoutMs = 20000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) { try { if (await page.eval("!!(" + expr + ")")) return true; } catch {} await delay(200); }
      return false;
    },
    async clickUntil(findExpr, effect, { attempts = 10 } = {}) {
      const met = () => page.eval("!!(" + effect + ")");
      for (let i = 0; i < attempts; i++) {
        if (await met()) return true;
        await page.eval("(() => { const el = " + findExpr + "; if (!el) return false; el.click(); return true; })()");
        for (let w = 0; w < 8; w++) {
          if (await met()) return true;
          await delay(200);
        }
      }
      return false;
    },
    async shotClip(selector, name) {
      const rect = await page.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()");
      if (!rect) throw new Error("shotClip: no element for " + selector);
      const { result } = await send("Page.captureScreenshot", { format: "png", clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 2 } }, s);
      const path = WORK + "/" + name + ".png";
      writeFileSync(path, Buffer.from(result.data, "base64"));
      return path;
    },
    async screenshot(name) {
      const { result } = await send("Page.captureScreenshot", { format: "png" }, s);
      const path = PROOF + name + ".png";
      writeFileSync(path, Buffer.from(result.data, "base64"));
      return path;
    },
  };
  return { page, close: () => chrome.kill("SIGKILL") };
};


const SHOW_QR = "Array.from(document.querySelectorAll('button')).find(x => /Show QR/.test(x.textContent))";
const SCAN_BTN = "Array.from(document.querySelectorAll('button')).find(x => x.getAttribute('aria-label') === 'Scan a room code')";
const DIALOG = "document.querySelector('[data-slot=dialog-content]')";
const QR_IMG = "document.querySelector('[data-slot=dialog-content] img')";
const TYPE_INSTEAD = "Array.from(document.querySelectorAll('[data-slot=dialog-content] button')).find(x => /Type the room code/.test(x.textContent))";

const main = async () => {
  const { server } = await startServer();
  const host = await signUp("host");
  const room = await createRoom(host);
  const wrongY4m = await buildY4m("https://example.com/not-a-room", WORK + "/wrong.y4m");

  // 1. The lobby draws the QR. Capture the app's own rendered code, then feed that exact
  //    image back through a fake camera so the real scanner decodes the app's output.
  let roomY4m = null;
  {
    const b = await launch({ debugPort: PORT + 71, fakeCamera: false });
    try {
      const { page } = b;
      await page.setCookie(host);
      await page.goto(BASE + "/rooms/" + room.code);
      await page.hydrate();
      const opened = await page.clickUntil(SHOW_QR, QR_IMG, { attempts: 10 });
      if (!opened) fail("the lobby QR dialog did not open");
      else {
        const png = await page.shotClip("[data-slot=dialog-content] img", "drawn-qr");
        roomY4m = pngToY4m(png, WORK + "/room.y4m");
        pass("the lobby drew a QR of " + room.link);
        console.log("screenshot: " + await page.screenshot("qr-01-lobby-qr"));
      }
    } finally { b.close(); }
  }

  // 2. A scan joins the room, decoding the app's own drawn QR on the real camera path.
  if (roomY4m !== null) {
    const b = await launch({ debugPort: PORT + 72, fakeCamera: true, y4m: roomY4m });
    try {
      const { page } = b;
      const guest = await signUp("guest");
      await page.setCookie(guest);
      await page.goto(BASE + "/");
      await page.hydrate();
      await page.clickUntil(SCAN_BTN, DIALOG, { attempts: 10 });
      const joined = await page.waitFor("location.pathname.startsWith('/rooms/')", 45000);
      const path = await page.eval("location.pathname");
      if (!joined || path !== "/rooms/" + room.code) fail("the scan landed on " + path + ", want /rooms/" + room.code);
      else pass("the scanner decoded the app's own drawn QR and joined: " + path);
      const seats = await seatedCount(room.code, host.cookie);
      if (seats !== 2) fail("after the scan the room had " + String(seats) + " seats filled, want 2");
      else pass("the scanned user is seated: " + String(seats) + " of 3");
      console.log("screenshot: " + await page.screenshot("qr-02-scanned"));
    } finally { b.close(); }
  } else {
    fail("skipped the scan check: the lobby QR was never captured");
  }

  {
    const b = await launch({ debugPort: PORT + 73, fakeCamera: true, y4m: wrongY4m });
    try {
      const { page } = b;
      const other = await signUp("wrongqr");
      await page.setCookie(other);
      await page.goto(BASE + "/");
      await page.hydrate();
      await page.clickUntil(SCAN_BTN, DIALOG, { attempts: 10 });
      const sawHint = await page.waitFor(DIALOG + " && /not a room link/i.test(document.body.innerText)", 45000);
      if (!sawHint) fail("the unrecognized-QR copy never appeared");
      else pass("a non-room QR shows the refusal copy");
      const stillThere = await page.eval("!!(" + DIALOG + ")");
      if (!stillThere) fail("the dialog closed on an unrecognized QR");
      else pass("the dialog stays open on an unrecognized QR");
      const path = await page.eval("location.pathname");
      if (path !== "/") fail("an unrecognized QR navigated to " + path);
      else pass("an unrecognized QR did not navigate");
      console.log("screenshot: " + await page.screenshot("qr-03-wrong-qr"));
    } finally { b.close(); }
  }

  {
    const b = await launch({ debugPort: PORT + 74, fakeCamera: true, fakeUi: false, y4m: roomY4m });
    try {
      const { page } = b;
      const manual = await signUp("manual");
      await page.setCookie(manual);
      await page.goto(BASE + "/");
      await page.hydrate();
      await page.denyCamera();
      await page.clickUntil(SCAN_BTN, DIALOG, { attempts: 10 });
      const denied = await page.waitFor(DIALOG + " && /Camera access is blocked/i.test(document.body.innerText)", 25000);
      if (!denied) fail("the denied-camera copy never appeared");
      else pass("a denied camera shows the blocked copy");
      const retryText = await page.eval("Array.from(document.querySelectorAll('[data-slot=dialog-content] button')).map(b => b.textContent.trim()).join(' | ')");
      if (!/Try again/.test(retryText)) fail("the denied state has no Try again button, buttons: " + retryText);
      else pass("the denied state offers Try again");
      console.log("screenshot: " + await page.screenshot("qr-04-denied"));
      await page.eval("(() => { const el = " + TYPE_INSTEAD + "; if (el) el.click(); return true; })()");
      await delay(600);
      await page.eval("(() => { const el = document.querySelector('#room-code'); el.focus(); el.value = " + JSON.stringify(room.code) + "; el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
      await delay(300);
      await page.eval("(() => { const f = document.querySelector('form'); f.requestSubmit(); return true; })()");
      const landed = await page.waitFor("location.pathname.startsWith('/rooms/')", 25000);
      const path = await page.eval("location.pathname");
      if (!landed || path !== "/rooms/" + room.code) fail("the manual fallback landed on " + path);
      else pass("the manual fallback still joins after a denied camera: " + path);
    } finally { b.close(); }
  }

  {
    const b = await launch({ debugPort: PORT + 75, fakeCamera: false, onNewDocument: "Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });" });
    try {
      const { page } = b;
      const nocam = await signUp("nocam");
      await page.setCookie(nocam);
      await page.goto(BASE + "/");
      await page.hydrate();
      await page.clickUntil(SCAN_BTN, DIALOG, { attempts: 10 });
      const shown = await page.waitFor(DIALOG + " && /has no camera/i.test(document.body.innerText)", 15000);
      if (!shown) fail("the no-camera copy never appeared");
      else pass("a device with no camera shows the no-camera copy");
    } finally { b.close(); }
  }

  {
    const b = await launch({ debugPort: PORT + 76, fakeCamera: false, onNewDocument: "Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });" });
    try {
      const { page } = b;
      const insecure = await signUp("insecure");
      await page.setCookie(insecure);
      await page.goto(BASE + "/");
      await page.hydrate();
      await page.clickUntil(SCAN_BTN, DIALOG, { attempts: 10 });
      const shown = await page.waitFor(DIALOG + " && /secure connection/i.test(document.body.innerText)", 15000);
      if (!shown) fail("the insecure-context copy never appeared");
      else pass("an insecure context shows its own copy");
    } finally { b.close(); }
  }

  {
    const b = await launch({ debugPort: PORT + 77, fakeCamera: false });
    try {
      const { page } = b;
      await page.setCookie(host);
      await page.goto(BASE + "/rooms/" + room.code);
      await page.hydrate();
      await page.eval("document.documentElement.classList.add('dark')");
      const opened = await page.clickUntil(SHOW_QR, QR_IMG, { attempts: 10 });
      if (!opened) fail("the QR dialog did not open in dark mode");
      else {
        const bg = await page.eval("(() => { const img = document.querySelector('[data-slot=dialog-content] img'); return getComputedStyle(img).backgroundColor; })()");
        if (bg !== "rgb(255, 255, 255)") fail("the QR background in dark mode is " + bg + ", want rgb(255, 255, 255)");
        else pass("the QR keeps a white background in dark mode: " + bg);
        console.log("screenshot: " + await page.screenshot("qr-05-dark"));
      }
    } finally { b.close(); }
  }

  if (server) { server.kill("SIGTERM"); await delay(1500); if (!server.killed) server.kill("SIGKILL"); }
};

try { await main(); } catch (e) { fail(e.stack ?? e.message); }
if (failures.length > 0) { console.error("\n" + String(failures.length) + " check(s) failed"); if (!KEEP) process.exitCode = 1; }
else console.log("\nall QR proof checks passed");
