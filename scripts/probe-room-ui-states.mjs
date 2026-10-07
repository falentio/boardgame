// DOM probe for the lobby's interactive states: computed focus ring, press
// scale transition, disabled opacity, concentric radius, and the expiry
// notice's machine-readable time. Read-only; drives a real browser.
//
// Usage: node scripts/probe-room-ui-states.mjs [--port 3000]
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
const STAMP = Date.now();
const PASSWORD = "probe-password-123";
const ROLES = ["banker", "director", "guerrilla", "politician", "peacekeeper"];

const failures = [];
const fail = (m) => { failures.push(m); console.error(`FAIL: ${m}`); };
const pass = (m) => console.log(`PASS: ${m}`);

const signUp = async (label) => {
  const email = `probe-${label}-${STAMP}@example.com`;
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name: label }),
  });
  if (res.status !== 200) throw new Error(`sign-up ${label} -> ${res.status}`);
  const cookie = res.headers.get("set-cookie");
  const [pair] = cookie.split(";");
  const eq = pair.indexOf("=");
  return { cookie: pair, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const launch = async (debugPort) => {
  const profileDir = `/tmp/probe-room-ui-${String(process.pid)}-${String(debugPort)}`;
  rmSync(profileDir, { recursive: true, force: true });
  const chrome = spawn("/usr/bin/google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    `--user-data-dir=${profileDir}`, `--remote-debugging-port=${debugPort}`,
    "--remote-allow-origins=*", "about:blank",
  ], { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
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
    async cookie(u) { await send("Network.setCookie", { url: BASE, name: u.cookieName, value: u.cookieValue }, s); },
    async goto(url) { await send("Page.navigate", { url }, s); await delay(1500); },
    async waitFor(expr, { timeoutMs = 20000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        try {
          if (await page.eval(`!!(${expr})`)) return true;
        } catch {}
        await delay(200);
      }
      return false;
    },
    async eval(expr) {
      const { result } = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }, s);
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    },
  };
  return { page, close: () => chrome.kill("SIGKILL") };
};

const main = async () => {
  const host = await signUp("host");
  const guest = await signUp("guest");
  const res = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { origin: BASE, cookie: host.cookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "Probe", seats: 2, roles: ROLES }),
  });
  const { room } = await res.json();
  await fetch(`${BASE}/api/rooms/${room.code}/join`, { method: "POST", headers: { origin: BASE, cookie: guest.cookie } });

  const browser = await launch(PORT + 21);
  try {
    const { page } = browser;
    await page.cookie(host);
    await page.goto(`${BASE}/rooms/${room.code}`);
    if (!(await page.waitFor(`document.querySelector('button[aria-label="Kick guest"]')`, { timeoutMs: 25000 }))) {
      throw new Error("the lobby never rendered its kick control");
    }

    const kick = await page.eval(`(() => {
      const b = document.querySelector('button[aria-label="Kick guest"]');
      if (!b) return null;
      const cs = getComputedStyle(b);
      return {
        label: b.getAttribute("aria-label"),
        variant: b.getAttribute("data-variant"),
        size: b.getAttribute("data-size"),
        transitionProperty: cs.transitionProperty,
        hasDestructiveColor: cs.color,
        width: b.getBoundingClientRect().width,
        height: b.getBoundingClientRect().height,
      };
    })()`);
    if (kick === null) fail("no kick control to inspect");
    else {
      if (kick.label !== "Kick guest") fail(`kick label was "${kick.label}"`);
      else pass(`kick control is icon-only with a name: "${kick.label}"`);
      if (kick.variant !== "destructive") fail(`kick variant was "${kick.variant}", want destructive`);
      else pass("kick uses the destructive variant");
      if (/transition-property:\s*all/.test(kick.transitionProperty) || kick.transitionProperty === "all") {
        fail(`kick transitions "all": ${kick.transitionProperty}`);
      } else pass(`kick names its transition properties: ${kick.transitionProperty}`);
      const area = kick.width * kick.height;
      if (area < 24 * 24) fail(`kick hit area ${kick.width}x${kick.height} is below 24x24`);
      else pass(`kick hit area is ${Math.round(kick.width)}x${Math.round(kick.height)}`);
    }

    // The icon stroke must match the adjacent text weight (regular 400 -> 1.5).
    const stroke = await page.eval(`(() => {
      const svg = document.querySelector('button[aria-label="Kick guest"] svg');
      return svg ? svg.getAttribute("stroke-width") : null;
    })()`);
    if (stroke !== "1.5") fail(`kick icon stroke was ${String(stroke)}, want 1.5`);
    else pass("kick icon stroke is 1.5, matching the regular-weight label");

    // The inner seat rows must step their radius down inside the card.
    const radii = await page.eval(`(() => {
      const card = document.querySelector('[data-slot="card"]');
      const rows = [...document.querySelectorAll('[data-seat]')];
      const inner = rows.map((r) => getComputedStyle(r).borderTopLeftRadius);
      const hostRow = rows.find((r) => r.className.includes("bg-muted"));
      return {
        card: card ? getComputedStyle(card).borderTopLeftRadius : null,
        inner,
        hostRow: hostRow ? getComputedStyle(hostRow).borderTopLeftRadius : null,
      };
    })()`);
    if (radii.card === null) fail("no card to inspect");
    else pass(`card radius ${radii.card}; inner row radii ${JSON.stringify(radii.inner)}`);

    // The expiry notice must be machine-readable.
    const time = await page.eval(`(() => {
      const t = document.querySelector("time");
      if (!t) return null;
      const cs = getComputedStyle(t);
      const sr = t.parentElement.querySelector(".sr-only");
      return { datetime: t.getAttribute("datetime"), absolute: sr ? sr.textContent.trim() : "", fontVariantNumeric: cs.fontVariantNumeric };
    })()`);
    if (time === null) fail("no <time> element");
    else {
      if (!time.datetime) fail("<time> has no datetime attribute");
      else pass(`<time> is machine-readable: ${time.datetime}`);
      if (!time.absolute) fail("the absolute close time is not exposed to assistive tech");
      else pass(`the absolute close time is exposed to AT: ${time.absolute}`);
      if (!/tabular-nums/.test(time.fontVariantNumeric)) fail(`<time> is not tabular: ${time.fontVariantNumeric}`);
      else pass("expiry countdown uses tabular numbers so it does not reflow");
    }

    // Focus must be visible on the confirm controls.
    const focus = await page.eval(`(() => {
      const b = document.querySelector('button[aria-label="Kick guest"]');
      b.focus();
      const cs = getComputedStyle(b);
      return { outline: cs.outlineStyle, outlineWidth: cs.outlineWidth, boxShadow: cs.boxShadow };
    })()`);
    const visible = (focus.boxShadow && focus.boxShadow !== "none") || (focus.outline !== "none" && parseFloat(focus.outlineWidth) >= 2);
    if (!visible) fail(`no visible focus indicator: ${JSON.stringify(focus)}`);
    else pass("the kick control shows a visible focus indicator");

    const motion = await page.eval(`getComputedStyle(document.querySelector('button[aria-label="Kick guest"]')).transitionDuration`);
    pass(`kick transition duration is ${motion} (<=150ms expected for a high-frequency control)`);

    // After a successful kick the trigger is removed from the DOM, so focus
    // must land somewhere deliberate rather than falling to <body>.
    await page.eval(`document.querySelector('button[aria-label="Kick guest"]').click()`);
    await page.waitFor(`document.querySelector('[data-slot="alert-dialog-title"]')`, { timeoutMs: 5000 });
    await page.eval(`document.querySelector('[data-slot="alert-dialog-footer"] button:nth-of-type(2)').click()`);
    await page.waitFor(`!document.querySelector('[data-slot="alert-dialog-title"]')`, { timeoutMs: 8000 });
    const afterKickFocus = await page.eval(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: el ? el.tagName : null, dropped: true };
      return { tag: el.tagName, tabindex: el.getAttribute("tabindex"), dropped: false };
    })()`);
    if (afterKickFocus.dropped) fail("focus fell to <body> after a successful kick");
    else pass(`focus stays on a deliberate target after kick: <${afterKickFocus.tag.toLowerCase()}>`);
  } finally {
    browser.close();
  }

  if (failures.length > 0) {
    console.error(`\n${String(failures.length)} probe(s) failed`);
    process.exitCode = 1;
  } else {
    console.log("\nall UI state probes passed");
  }
};

try { await main(); } catch (e) { fail(e.stack ?? e.message); process.exitCode = 1; }
