// Usage: node scripts/proof-role-cards.mjs [--port 3000] [--keep]
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
const ROUTE = "/dev/role-cards";

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
};
const pass = (msg) => console.log(`PASS: ${msg}`);

mkdirSync(PROOF, { recursive: true });

const profileDir = `/tmp/proof-role-cards-${PORT}-${process.pid}`;
rmSync(profileDir, { recursive: true, force: true });

// All worktrees share one node_modules/.vite dep cache, so two dev servers
// writing it corrupt the cache and the page stops hydrating. Reuse a server
// that already answers and only spawn one when nothing is listening.
const serverAnswers = async () => {
  try {
    const res = await fetch(`${BASE}${ROUTE}`);
    return res.ok;
  } catch {
    return false;
  }
};

const startServer = async () => {
  if (await serverAnswers()) return { server: null };
  const server = spawn(
    "pnpm",
    ["exec", "nuxt", "dev", "--port", String(PORT), "--host", "localhost"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" } },
  );
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 180; i++) {
    if (await serverAnswers()) return { server };
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
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });

  const { result: created } = await send("Target.createTarget", { url: "about:blank" });
  const { result: attached } = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const session = attached.sessionId;
  await send("Page.enable", {}, session);
  await send("Runtime.enable", {}, session);

  const page = {
    async goto(url, { waitMs = 2500 } = {}) {
      await send("Page.navigate", { url }, session);
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
    async setViewport(width, height) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, session);
      await delay(400);
    },
    async waitForHydration({ timeoutMs = 30000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await page.eval("!!document.querySelector('#__nuxt')?.__vue_app__")) return true;
        await delay(250);
      }
      throw new Error("Vue never hydrated");
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
    await browser.page.setViewport(1280, 900);
    await browser.page.goto(`${BASE}${ROUTE}`);
    await browser.page.waitForHydration();

    const cardCount = await browser.page.eval("document.querySelectorAll('[data-slot=role-card]').length");
    if (cardCount < 20) fail(`expected many role cards, found ${cardCount}`);
    else pass(`rendered ${cardCount} role cards`);

    const unnamed = await browser.page.eval(
      `(() => { const btns = [...document.querySelectorAll('button[data-slot=role-card]')]; return btns.filter((b) => !b.getAttribute('aria-label')).length; })()`,
    );
    if (unnamed > 0) fail(`${unnamed} selectable card(s) have no accessible name`);
    else pass("every selectable card has an accessible name");

    const sampleName = await browser.page.eval(
      `document.querySelector('button[data-slot=role-card]')?.getAttribute('aria-label') ?? null`,
    );
    if (!sampleName || !/role/.test(sampleName)) fail(`accessible name looks wrong: ${sampleName}`);
    else pass(`accessible name sample "${sampleName}"`);

    const named = await browser.page.eval(
      `(() => { const labels = [...document.querySelectorAll('[data-slot=role-card]')].map((c) => c.getAttribute('aria-label') ?? ''); const find = (p) => labels.find((l) => l.startsWith(p)) ?? null; return { guerrilla: find('Guerrilla'), judge: find('Judge'), paramilitary: find('Paramilitary') }; })()`,
    );
    if (!named.guerrilla?.includes("Pay 4") || !named.guerrilla?.includes("Blocked by Guerrilla")) {
      fail(`Guerrilla name should carry Pay 4 and Blocked by Guerrilla, got "${named.guerrilla}"`);
    } else pass("Guerrilla name carries cost and block");
    if (!named.judge?.includes("Give 3")) fail(`Judge name should carry "Give 3", got "${named.judge}"`);
    else pass(`Judge name carries "Give 3"`);
    if (!named.paramilitary?.includes("Pay 3 / 5")) {
      fail(`Paramilitary name should carry "Pay 3 / 5", got "${named.paramilitary}"`);
    } else pass(`Paramilitary name carries "Pay 3 / 5"`);

    const visible = await browser.page.eval(
      `(() => { const t = document.body.innerText.toLowerCase(); return { give: t.includes('give 3'), param: t.includes('pay 3 / 5'), spent: t.includes('spent') }; })()`,
    );
    if (!visible.give) fail(`Judge cost value "Give 3" is not visible`);
    if (!visible.param) fail(`Paramilitary cost value "Pay 3 / 5" is not visible`);
    if (!visible.spent) fail(`spent marker is not visible`);
    if (visible.give && visible.param && visible.spent) pass(`cost values and spent marker render`);

    const emptyFooterOk = await browser.page.eval(
      `(() => { const cards = [...document.querySelectorAll('[data-slot=role-card]')]; const intel = cards.find((c) => (c.getAttribute('aria-label') ?? '').startsWith('Intellectual')); if (!intel) return 'no-intellectual'; return /pay |give |blocked by|\\bcost\\b|\\bblock\\b/i.test(intel.innerText) ? 'footer-shown' : 'footer-hidden'; })()`,
    );
    if (emptyFooterOk === "footer-shown") fail(`Intellectual (no cost, no block) should hide its meta footer`);
    else if (emptyFooterOk === "footer-hidden") pass(`empty footer hidden for a cost/block-free role`);

    const clipped = await browser.page.eval(
      `(() => { const names = [...document.querySelectorAll('[data-slot=role-card-name]')]; const bad = names.filter((el) => el.scrollWidth > el.clientWidth + 1); return bad.slice(0, 3).map((el) => el.textContent.trim()); })()`,
    );
    if (clipped.length > 0) fail(`name text clipped in ${clipped.join(", ")}`);
    else pass(`no role name is clipped`);

    const spine = await browser.page.eval(
      `(() => { const el = document.querySelector('[data-slot=role-card-spine]'); return el ? 'present' : null; })()`,
    );
    if (!spine) fail(`spine column missing`);
    else pass(`spine column renders`);

    console.log(`screenshot: ${await browser.page.screenshot("role-card-promoted")}`);

    await browser.page.setViewport(320, 800);
    await browser.page.goto(`${BASE}${ROUTE}`);
    await browser.page.waitForHydration();
    const overflow = await browser.page.eval(
      "document.documentElement.scrollWidth - document.documentElement.clientWidth",
    );
    if (overflow > 1) fail(`page overflows the 320px viewport by ${overflow}px`);
    else pass(`no horizontal overflow at 320px`);
    console.log(`screenshot: ${await browser.page.screenshot("role-card-promoted-320")}`);
  } finally {
    browser.close();
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
  console.log("\nall role-card proof checks passed");
}
