// Live proof that the /rooms/new role picker lays its groups out as horizontal
// scroll strips and keeps its pick/clear contract. The layout checks fail
// against the old grid and pass once the picker uses the strip pattern.
//
// Usage: node scripts/proof-room-picker-strip.mjs [--port 3290] [--out DIR] [--keep]
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf("--port", "3290"));
const KEEP = args.includes("--keep");
const BASE = `http://localhost:${PORT}`;
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = argOf("--out", new URL("../.audit/proof/", import.meta.url).pathname);
const STAMP = Date.now();
const PASSWORD = "proof-password-123";

const failures = [];
const fail = (msg) => { failures.push(msg); console.error(`FAIL: ${msg}`); };
const pass = (msg) => console.log(`PASS: ${msg}`);
const info = (msg) => console.log(`INFO: ${msg}`);

mkdirSync(OUT, { recursive: true });

const serverAnswers = async () => {
  try {
    const res = await fetch(`${BASE}/api/auth/ok`);
    return res.status < 500;
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

const signUp = async () => {
  const email = `picker-${STAMP}@example.com`;
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name: "Picker Proof" }),
  });
  if (res.status !== 200) throw new Error(`sign-up returned ${res.status}: ${await res.text()}`);
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("sign-up set no cookie");
  const [pair] = cookie.split(";");
  const eq = pair.indexOf("=");
  return { cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const launchBrowser = async (label, debugPort) => {
  const profileDir = `/tmp/proof-picker-${label}-${PORT}-${process.pid}`;
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
      await delay(300);
    },
    async setSessionCookie(user) {
      await send("Network.setCookie", { url: BASE, name: user.cookieName, value: user.cookieValue }, session);
    },
    async goto(url, { waitMs = 1800 } = {}) {
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
    async waitFor(expression, { timeoutMs = 10000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) { if (await page.eval(`!!(${expression})`)) return true; await delay(200); }
      return false;
    },
    async waitForHydration({ timeoutMs = 30000 } = {}) {
      const ok = await page.waitFor("document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__", { timeoutMs });
      if (!ok) throw new Error("Vue never hydrated");
      return true;
    },
    async rectOf(jsEl) {
      return page.eval(`(() => { const el = ${jsEl}; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!el.disabled }; })()`);
    },
    async mouseClick(x, y) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 }, session);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 }, session);
      await delay(80);
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 }, session);
    },
    // A cold dev server reflows the page mid-click, so a stale rect misses the
    // card and the click no-ops. Confirm the probe value changed, else retry.
    async clickUntilChanged(jsEl, probeExpr, { attempts = 8 } = {}) {
      const before = await page.eval(probeExpr);
      for (let i = 0; i < attempts; i++) {
        const first = await page.rectOf(jsEl);
        if (first === null || first.disabled) { await delay(250); continue; }
        await delay(150);
        const again = await page.rectOf(jsEl);
        if (again === null || again.disabled) continue;
        if (Math.abs(first.x - again.x) >= 2 || Math.abs(first.y - again.y) >= 2) continue;
        await page.mouseClick(again.x, again.y);
        await delay(350);
        const after = await page.eval(probeExpr);
        if (after !== before) return { changed: true, before, after };
      }
      return { changed: false, before, after: await page.eval(probeExpr) };
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

const financePressedProbe = `(() => {
  const label = document.getElementById('role-group-finance');
  const cards = [...label.closest('[role=group]').querySelectorAll('[data-role-option]')];
  return JSON.stringify(cards.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.getAttribute('aria-label')));
})()`;

const financeFirstUnpressed = `(() => {
  const label = document.getElementById('role-group-finance');
  const cards = [...label.closest('[role=group]').querySelectorAll('[data-role-option]')];
  return cards.find((c) => c.getAttribute('aria-pressed') === 'false') ?? null;
})()`;

const financePressedCard = `(() => {
  const label = document.getElementById('role-group-finance');
  const cards = [...label.closest('[role=group]').querySelectorAll('[data-role-option]')];
  return cards.find((c) => c.getAttribute('aria-pressed') === 'true') ?? null;
})()`;

const main = async () => {
  const { server, reused } = await startServer();
  if (reused) console.warn("note: reusing an already-running dev server; not validated as this checkout");
  let browser = null;
  try {
    const user = await signUp();
    pass("created the proof account");

    browser = await launchBrowser("main", PORT + 41);
    await browser.page.setViewport(1280, 900);
    await browser.page.setSessionCookie(user);
    await browser.page.goto(`${BASE}/rooms/new`);
    const onForm = await browser.page.waitFor("location.pathname === '/rooms/new'", { timeoutMs: 15000 });
    if (!onForm) throw new Error(`did not land on the create form, at ${await browser.page.eval("location.pathname")}`);
    await browser.page.waitForHydration();
    const cardsReady = await browser.page.waitFor("document.querySelectorAll('[data-role-option]').length >= 10");
    if (!cardsReady) throw new Error("role option cards never rendered");
    const settled = await browser.page.waitFor(`(() => {
      const label = document.getElementById('role-group-finance');
      const strip = label ? label.closest('[role=group]').querySelector('[data-slot=role-strip], .grid') : null;
      return !!strip && getComputedStyle(strip).display !== 'none';
    })()`, { timeoutMs: 10000 });
    if (!settled) throw new Error("the finance card container never settled");
    await delay(800);
    pass("the create form rendered the role picker");

    const countLine = () => browser.page.eval(
      "(() => { const p = [...document.querySelectorAll('p')].find((n) => /of 5 chosen/.test(n.textContent)); return p ? p.textContent.trim() : null; })()",
    );
    const missingLine = () => browser.page.eval(
      "(() => { const p = [...document.querySelectorAll('p')].find((n) => /Still to choose/.test(n.textContent)); return p ? p.textContent.trim() : null; })()",
    );
    const submitDisabled = () => browser.page.eval(
      "(() => { const b = document.querySelector('button[type=submit]'); return b ? b.disabled : null; })()",
    );

    const initialCount = await countLine();
    if (initialCount !== "5 of 5 chosen") fail(`fresh form should show 5 of 5 chosen, got ${JSON.stringify(initialCount)}`);
    else pass("the fresh form shows 5 of 5 chosen");

    const labels = await browser.page.eval(
      "(() => ['Finance', 'Communications', 'Force', 'Special Interest'].map((t) => ({ t, ok: [...document.querySelectorAll('p')].some((n) => n.textContent.trim().startsWith(t)) })))()",
    );
    for (const l of labels) {
      if (l.ok) pass(`group label ${JSON.stringify(l.t)} renders`);
      else fail(`group label ${JSON.stringify(l.t)} missing`);
    }

    const pressedBefore = JSON.parse(await browser.page.eval(financePressedProbe));
    const swap = await browser.page.clickUntilChanged(financeFirstUnpressed, financePressedProbe);
    if (!swap.changed) fail(`clicking an unpicked finance card changed nothing (pressed stayed ${JSON.stringify(swap.before)})`);
    else {
      const nowPressed = JSON.parse(swap.after);
      if (nowPressed.length !== 1) fail(`exactly one finance card should be pressed after the swap, got ${JSON.stringify(nowPressed)}`);
      else if (nowPressed[0] === pressedBefore[0]) fail("the swap kept the old finance pick pressed");
      else pass(`picking ${JSON.stringify(nowPressed[0])} replaced ${JSON.stringify(pressedBefore[0])} in the finance slot`);
      const swappedCount = await countLine();
      if (swappedCount !== "5 of 5 chosen") fail(`count should stay 5 of 5 chosen after a swap, got ${JSON.stringify(swappedCount)}`);
      else pass("the count still reads 5 of 5 chosen after the swap");
    }

    const clear = await browser.page.clickUntilChanged(financePressedCard, financePressedProbe);
    if (!clear.changed) fail(`clicking the pressed finance card changed nothing (pressed stayed ${JSON.stringify(clear.before)})`);
    else {
      const count = await countLine();
      if (count !== "4 of 5 chosen") fail(`clearing a pick should read 4 of 5 chosen, got ${JSON.stringify(count)}`);
      else pass("clearing a pick reads 4 of 5 chosen");
      const missing = await missingLine();
      if (!missing || !missing.includes("1 Finance")) fail(`missing line should name the empty Finance slot, got ${JSON.stringify(missing)}`);
      else pass(`missing line reads ${JSON.stringify(missing)}`);
      const disabled = await submitDisabled();
      if (disabled !== true) fail(`submit should be disabled with an incomplete draft, got ${disabled}`);
      else pass("submit is disabled with an incomplete draft");
    }

    const restore = await browser.page.clickUntilChanged(financeFirstUnpressed, financePressedProbe);
    if (!restore.changed) fail(`re-picking a finance card changed nothing (pressed stayed ${JSON.stringify(restore.before)})`);
    else {
      const restored = await countLine();
      if (restored !== "5 of 5 chosen") fail(`re-picking should restore 5 of 5 chosen, got ${JSON.stringify(restored)}`);
      else pass("re-picking restores 5 of 5 chosen");
      const enabled = await submitDisabled();
      if (enabled !== false) fail(`submit should be enabled with a complete draft, got ${enabled}`);
      else pass("submit is enabled with a complete draft");
    }

    const layout = await browser.page.eval(`(() => {
      const strips = [...document.querySelectorAll('[data-slot=role-strip]')];
      return strips.map((strip) => {
        const cs = getComputedStyle(strip);
        const cards = [...strip.querySelectorAll('[data-role-option]')];
        const first = cards[0];
        const last = cards[cards.length - 1];
        strip.scrollLeft = 0;
        return {
          display: cs.display,
          overflowX: cs.overflowX,
          flexWrap: cs.flexWrap,
          flexShrink: first ? getComputedStyle(first).flexShrink : null,
          singleRow: first && last ? Math.abs(first.getBoundingClientRect().top - last.getBoundingClientRect().top) < 1 : null,
          scrolls: strip.scrollWidth > strip.clientWidth + 4,
          scrollLeftAfterSet: (() => { strip.scrollLeft = strip.scrollWidth; const v = strip.scrollLeft; strip.scrollLeft = 0; return v; })(),
        };
      });
    })()`);
    info(`layout: ${JSON.stringify(layout)}`);
    if (layout.length !== 4) fail(`expected 4 role strips, found ${layout.length}`);
    else pass("each of the four role groups renders a role strip");
    for (const [i, s] of layout.entries()) {
      const tag = `strip ${i}`;
      let ok = true;
      if (s.display !== "flex") { fail(`${tag} should be display:flex, got ${s.display}`); ok = false; }
      if (s.overflowX !== "auto" && s.overflowX !== "scroll") { fail(`${tag} should scroll horizontally, got overflow-x ${s.overflowX}`); ok = false; }
      if (s.flexWrap !== "nowrap") { fail(`${tag} should not wrap, got flex-wrap ${s.flexWrap}`); ok = false; }
      if (s.flexShrink !== "0") { fail(`${tag} cards should not shrink, got flex-shrink ${s.flexShrink}`); ok = false; }
      if (s.singleRow !== true) { fail(`${tag} should keep all cards on one row`); ok = false; }
      if (s.scrollLeftAfterSet <= 0) { fail(`${tag} does not actually scroll horizontally`); ok = false; }
      if (ok) pass(`${tag} is a horizontal scroll strip (${s.scrolls ? "content overflows and scrolls" : "fits without scrolling"})`);
    }

    const ringRoom = await browser.page.eval(`(() => {
      const strips = [...document.querySelectorAll('[data-slot=role-strip]')];
      return strips.map((strip) => {
        const cards = [...strip.querySelectorAll('[data-role-option]')];
        const gr = strip.getBoundingClientRect();
        strip.scrollLeft = 0;
        const first = cards[0].getBoundingClientRect();
        strip.scrollLeft = strip.scrollWidth;
        const last = cards[cards.length - 1].getBoundingClientRect();
        const out = {
          roomTop: +(first.top - gr.top).toFixed(2),
          roomLeft: +(first.left - gr.left).toFixed(2),
          roomRightAtEnd: +(gr.right - last.right).toFixed(2),
          scrolledToEnd: strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1,
        };
        strip.scrollLeft = 0;
        return out;
      });
    })()`);
    info(`ring room: ${JSON.stringify(ringRoom)}`);
    for (const [i, r] of ringRoom.entries()) {
      const tag = `strip ${i}`;
      let ok = true;
      if (r.roomTop < 2) { fail(`${tag} leaves ${r.roomTop}px above the first card; the selected card's ring clips at the top`); ok = false; }
      if (r.roomLeft < 2) { fail(`${tag} leaves ${r.roomLeft}px left of the first card; the selected card's ring clips at the left edge`); ok = false; }
      if (r.scrolledToEnd && r.roomRightAtEnd < 2) { fail(`${tag} leaves ${r.roomRightAtEnd}px right of the last card at the scroll end; the ring clips at the right edge`); ok = false; }
      if (ok) pass(`${tag} leaves ${r.roomLeft}/${r.roomTop}/${r.roomRightAtEnd}px of ring room at the strip edges`);
    }

    const wide = await browser.page.screenshot("rooms-new-picker-1280");
    console.log(`screenshot: ${wide}`);

    await browser.page.setViewport(375, 800);
    await browser.page.goto(`${BASE}/rooms/new`);
    await browser.page.waitForHydration();
    await browser.page.waitFor("document.querySelectorAll('[data-role-option]').length >= 10");
    await delay(600);
    const narrow = await browser.page.eval(`(() => {
      const strips = [...document.querySelectorAll('[data-slot=role-strip]')];
      return {
        pageScrolls: document.documentElement.scrollWidth > window.innerWidth + 1,
        stripsScroll: strips.map((s) => s.scrollWidth > s.clientWidth + 4),
      };
    })()`);
    info(`narrow: ${JSON.stringify(narrow)}`);
    if (narrow.pageScrolls) fail("the page scrolls horizontally at 375px");
    else pass("no page-level horizontal scroll at 375px");
    if (!narrow.stripsScroll.some(Boolean)) fail("no strip scrolls at 375px");
    else pass("strips still scroll at 375px");
    const shotNarrow = await browser.page.screenshot("rooms-new-picker-375");
    console.log(`screenshot: ${shotNarrow}`);
  } finally {
    if (browser !== null) browser.close();
    if (server) { server.kill("SIGTERM"); await delay(1500); if (!server.killed) server.kill("SIGKILL"); }
  }
};

try { await main(); } catch (error) { fail(error.stack ?? error.message); }
if (failures.length > 0) { console.error(`\n${failures.length} check(s) failed`); if (!KEEP) process.exitCode = 1; }
