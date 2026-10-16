// Live proof of the citadels gate -> fullscreen surface on the real /games/<code>
// page: the entry needs a real activation, exiting returns to the gate with the
// session intact, a refused request still reveals the surface with a retry, and
// rotation flips only data-orientation.
//
// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth
// rejects the sign-up with INVALID_ORIGIN.
// This worktree also needs .dev.vars and a migrated local D1 (pnpm db:migrate:local):
// without them the auth routes answer 500 and no beat can start.
//
// Usage: node scripts/proof-citadels-surface.mjs [--port 3000] [--out DIR]
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
const ROOT = new URL("..", import.meta.url).pathname;
const OUT = argOf("--out", new URL("../.audit/proof/", import.meta.url).pathname);
const STAMP = Date.now();
const PASSWORD = "proof-password-123";

mkdirSync(OUT, { recursive: true });

const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`FAIL: ${msg}`);
};
const pass = (msg) => console.log(`PASS: ${msg}`);
const info = (msg) => console.log(`INFO: ${msg}`);

const serverAnswers = async () => {
  try {
    const res = await fetch(`${BASE}/api/auth/ok`);
    return res.ok;
  } catch {
    return false;
  }
};

// All worktrees share one node_modules/.vite dep cache, so two dev servers
// writing it corrupt the cache and the page stops hydrating. Reuse a server
// that already answers and only spawn one when nothing is listening.
const startServer = async () => {
  if (await serverAnswers()) return { server: null, reused: true };
  // detached so the whole group can be reaped: a signal aimed at pnpm alone
  // leaves the vite/nitro child behind, holding the port.
  const server = spawn(
    "pnpm",
    ["exec", "nuxt", "dev", "--port", String(PORT), "--host", "localhost"],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "development" }, detached: true },
  );
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 240; i++) {
    if (await serverAnswers()) return { server, reused: false };
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`dev server exited before it answered:\n${log.slice(-4000)}`);
    }
    await delay(1000);
  }
  throw new Error(`dev server never became ready:\n${log.slice(-4000)}`);
};

const signUp = async (label) => {
  const email = `surface-${label}-${STAMP}@example.com`;
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name: label }),
  });
  const body = await res.text();
  if (res.status !== 200) {
    // A worktree without .dev.vars or without its local D1 migrated answers the
    // auth routes with a bare 500, which no later assertion could explain.
    const hint = res.status === 500 ? " (check .dev.vars and run pnpm db:migrate:local)" : "";
    throw new Error(`sign-up ${label} returned ${res.status}${hint}: ${body.slice(0, 200)}`);
  }
  const { user } = JSON.parse(body);
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error(`sign-up ${label} set no cookie`);
  const [pair] = cookie.split(";");
  const eq = pair.indexOf("=");
  return { id: user.id, email, name: label, cookie: pair, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const launchBrowser = async (label, debugPort) => {
  const profileDir = `/tmp/proof-surface-${label}-${PORT}-${process.pid}`;
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
    async setViewport(width, height) {
      await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false }, session);
      await delay(300);
    },
    // Rotation in place: the page keeps its session, its data, and every node.
    async setOrientation({ width, height, type, angle }) {
      await send(
        "Emulation.setDeviceMetricsOverride",
        { width, height, deviceScaleFactor: 1, mobile: true, screenOrientation: { type, angle } },
        session,
      );
      await delay(400);
    },
    async setSessionCookie(user) {
      await send("Network.setCookie", { url: BASE, name: user.cookieName, value: user.cookieValue }, session);
    },
    // A cold dev server compiles the route on first request; a navigation that
    // races that compile can sit pending for a minute, so retry it.
    async goto(url, { waitMs = 1500, attempts = 3 } = {}) {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const started = Date.now();
        const loaded = new Promise((res) => {
          on("Page.loadEventFired", () => res());
          setTimeout(res, 20000);
        });
        const nav = await send("Page.navigate", { url }, session);
        await loaded;
        await delay(waitMs);
        if ((await page.eval("location.href")) !== "about:blank") {
          if (Date.now() - started > 3000) info(`${url} answered in ${Date.now() - started} ms`);
          return;
        }
        info(`${url} did not commit on attempt ${attempt + 1} (${JSON.stringify(nav.result?.errorText ?? null)})`);
      }
      throw new Error(`the browser never left about:blank for ${url}`);
    },
    async eval(expression) {
      const msg = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, session);
      if (msg.error) throw new Error(`eval error: ${JSON.stringify(msg.error)}`);
      if (msg.result.exceptionDetails) throw new Error(`eval failed: ${msg.result.exceptionDetails.text}`);
      return msg.result.result.value;
    },
    async href() {
      return page.eval("location.href");
    },
    async waitFor(expression, { timeoutMs = 10000 } = {}) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await page.eval(`!!(${expression})`)) return true;
        await delay(200);
      }
      return false;
    },
    // The dev server compiles a route on first request, so this waits far longer
    // than a warm page needs, and reports rather than throws: callers decide
    // whether a page that never hydrated is worth another load.
    async waitForHydration({ timeoutMs = 90000 } = {}) {
      return page.waitFor("document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__", { timeoutMs });
    },
    async rectOf(jsEl) {
      return page.eval(`(() => { const el = ${jsEl}; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    },
    async mouseClick(x, y) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 }, session);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 }, session);
      await delay(80);
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 }, session);
    },
    // A real CDP pointer sequence: a synthetic el.click() carries no user
    // activation, so it would prove the fallback instead of the fullscreen path.
    async clickElement(jsEl, effect, { attempts = 8 } = {}) {
      for (let i = 0; i < attempts; i++) {
        if (await page.eval(`!!(${effect})`)) return true;
        const first = await page.rectOf(jsEl);
        if (first === null) {
          await delay(250);
          continue;
        }
        await delay(200);
        const again = await page.rectOf(jsEl);
        if (again === null || Math.abs(first.x - again.x) >= 2 || Math.abs(first.y - again.y) >= 2) continue;
        await page.mouseClick(again.x, again.y);
        for (let wait = 0; wait < 6; wait++) {
          if (await page.eval(`!!(${effect})`)) return true;
          await delay(200);
        }
      }
      return false;
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

const GAME_PATH = "location.pathname.match(/^\\/games\\/[A-Z]{8,9}$/) !== null";
const BUTTON_TEXT = (text) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(${JSON.stringify(text)}))`;

const EL = {
  gate: "[data-slot=citadels-gate]",
  gatePhase: "[data-slot=citadels-gate] [data-slot=citadels-phase]",
  enter: "[data-slot=citadels-enter]",
  surface: "[data-slot=citadels-surface]",
  notice: "[data-slot=citadels-notice]",
  retry: "[data-slot=citadels-retry]",
  exit: "[data-slot=citadels-exit]",
};
const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;

const CITADELS_CAST = ["assassin", "thief", "magician", "king", "bishop", "merchant", "architect", "warlord"];
const G54_ROLES = ["banker", "director", "guerrilla", "politician", "peacekeeper"];

const PAGE_STATE = `(() => ({ href: location.href, immersive: !!document.querySelector('[data-slot=citadels-immersive]'), gate: !!document.querySelector('[data-slot=citadels-gate]'), surface: !!document.querySelector('[data-slot=citadels-surface]'), board: !!document.querySelector('[data-slot=game-board]'), text: document.body === null ? null : document.body.innerText.split(String.fromCharCode(10)).join(" | ").slice(0, 240) }))()`;

const GATE_STATE = `(() => {
  const el = document.querySelector('[data-slot=citadels-gate] [data-slot=citadels-phase]');
  if (el === null) return null;
  const text = el.textContent.trim();
  const parts = text.match(/^Round (\\d+) · (.+?) · (\\d+) characters$/);
  return { text, round: parts === null ? null : Number(parts[1]), phase: parts === null ? null : parts[2], characters: parts === null ? null : Number(parts[3]) };
})()`;

// The orientation attribute must reflow the board, not only flip an attribute.
const LAYOUT = `(() => {
  const board = document.querySelector('[data-slot=citadels-board]');
  const opponents = document.querySelector('[data-slot=citadels-opponents]');
  if (board === null || opponents === null) return null;
  const style = getComputedStyle(board);
  return { columns: style.gridTemplateColumns, opponents: getComputedStyle(opponents).flexDirection };
})()`;

// One read of everything the surface must carry across a rotation or a re-entry.
const FACTS = `(() => {
  const surface = document.querySelector('[data-slot=citadels-surface]');
  const line = document.querySelector('[data-slot=citadels-surface] [data-slot=citadels-phase]');
  const round = line === null ? null : Number((line.textContent.match(/Round (\\d+)/) ?? [])[1] ?? null);
  const seats = [...document.querySelectorAll('[data-slot=citadels-seat]')].map((seat) => ({
    seat: seat.getAttribute('data-seat'),
    gold: seat.getAttribute('data-gold'),
    districts: seat.querySelectorAll('[data-slot=citadels-district]').length,
  }));
  return {
    href: location.href,
    up: surface !== null,
    orientation: surface === null ? null : surface.getAttribute('data-orientation'),
    round,
    seats,
    hand: document.querySelectorAll('[data-slot=citadels-hand] [data-slot=citadels-district]').length,
  };
})()`;

const factDiffs = (before, after) => {
  const diffs = [];
  if (before.href !== after.href) diffs.push(`href ${before.href} -> ${after.href}`);
  if (before.round !== after.round) diffs.push(`round ${before.round} -> ${after.round}`);
  if (before.hand !== after.hand) diffs.push(`hand ${before.hand} -> ${after.hand}`);
  if (JSON.stringify(before.seats) !== JSON.stringify(after.seats)) {
    diffs.push(`seats ${JSON.stringify(before.seats)} -> ${JSON.stringify(after.seats)}`);
  }
  return diffs;
};

const createRoomThroughApi = async (user, { name, seats, setup }) => {
  const res = await fetch(`${BASE}/api/rooms`, {
    method: "POST",
    headers: { origin: BASE, cookie: user.cookie, "content-type": "application/json" },
    body: JSON.stringify({ name, seats, setup }),
  });
  if (res.status !== 201) {
    throw new Error(`create room returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const { room } = await res.json();
  pass(`created room ${room.code} (${setup.game}, ${seats} seats)`);
  return room.code;
};

// A cold or busy dev server can answer the page's module import with a 500, and
// a client that never hydrated is the same failure from a different angle: load
// the route again instead of proving on a page the browser never ran.
const openRoute = async (page, url, { attempts = 3, timeoutMs = 45000 } = {}) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await page.goto(url);
    const hydrated = await page.waitForHydration({ timeoutMs });
    if (hydrated) {
      const broken = await page.eval("document.body !== null && document.body.innerText.includes('Failed to fetch dynamically imported module')");
      if (!broken) return;
      info(`${url} answered the page module with an error (attempt ${attempt + 1}); loading it again`);
      continue;
    }
    info(`${url} never hydrated on attempt ${attempt + 1}; loading it again`);
  }
  throw new Error(`${url} never reached a hydrated page`);
};

const joinThroughLink = async (page, code) => {
  await openRoute(page, `${BASE}/join/${code}`);
  const seated = await page.waitFor(`location.pathname === '/rooms/${code}'`, { timeoutMs: 30000 });
  if (!seated) throw new Error(`the join link did not seat the account, at ${await page.href()}`);
};

const startThroughLobby = async (page, code) => {
  await openRoute(page, `${BASE}/rooms/${code}`);
  const full = await page.waitFor("document.body.innerText.includes('All seats filled')", { timeoutMs: 30000 });
  if (!full) throw new Error(`room ${code} never filled its seats`);
  const started = page.waitFor(GAME_PATH, { timeoutMs: 30000 });
  await page.clickElement(BUTTON_TEXT("Start game"), GAME_PATH);
  if (!(await started)) throw new Error(`Start game did not open the board, at ${await page.href()}`);
};

const runBeats = async (beats) => {
  let stopped = null;
  for (const [index, beat] of beats.entries()) {
    const label = `beat ${index + 1} — ${beat.name}`;
    if (stopped !== null) {
      fail(`${label} (not run: ${stopped})`);
      continue;
    }
    const before = failures.length;
    try {
      await beat.run();
    } catch (error) {
      fail(`${label}: ${error.message}`);
      stopped = error.message;
    }
    console.log(`${failures.length === before ? "PASS" : "FAIL"}: ${label}`);
  }
};

const main = async () => {
  const { server, reused } = await startServer();
  if (reused) info(`reusing the dev server already answering on ${BASE}`);
  // A cold dev server compiles each route on first request; warm the shell
  // before a browser has to wait on it.
  for (const route of ["/", "/rooms/new"]) {
    try {
      await fetch(BASE + route);
    } catch {}
  }
  const browsers = [];
  try {
    const host = await signUp("host");
    const guest = await signUp("guest");
    const other = await signUp("other");
    pass(`created accounts ${host.email}, ${guest.email}, ${other.email}`);

    const hostBrowser = await launchBrowser("host", PORT + 81);
    const guestBrowser = await launchBrowser("guest", PORT + 82);
    const otherBrowser = await launchBrowser("other", PORT + 83);
    browsers.push(hostBrowser, guestBrowser, otherBrowser);
    const hostPage = hostBrowser.page;
    const guestPage = guestBrowser.page;
    const otherPage = otherBrowser.page;
    for (const [browser, user] of [[hostBrowser, host], [guestBrowser, guest], [otherBrowser, other]]) {
      await browser.page.setViewport(1280, 800);
      await browser.page.setSessionCookie(user);
    }

    const citadels = await createRoomThroughApi(host, { name: "Citadels surface proof", seats: 3, setup: { game: "citadels", cast: CITADELS_CAST } });
    await joinThroughLink(otherPage, citadels);
    await joinThroughLink(guestPage, citadels);
    pass(`both guest accounts joined ${citadels} through the shared link`);
    await startThroughLobby(hostPage, citadels);
    pass(`the host started ${citadels}`);
    // The citadels screen is the heaviest module graph in the app: let the host
    // page finish compiling it before another browser asks for the same route.
    const hostScreen = await hostPage.waitFor(`!!document.querySelector('[data-slot=citadels-immersive]')`, { timeoutMs: 120000 });
    info(`host citadels screen mounted: ${hostScreen}`);

    let landscape = null;
    let gateRound = null;

    const beats = [
      {
        name: "a started citadels room gates a seated non-host",
        run: async () => {
          await openRoute(guestPage, `${BASE}/games/${citadels}`);
          const gated = await guestPage.waitFor(
            `${q(EL.gate)} && !document.querySelector(${JSON.stringify(EL.surface)})`,
            { timeoutMs: 120000 },
          );
          if (!gated) {
            fail(`no gate on /games/${citadels} for a seated non-host: ${JSON.stringify(await guestPage.eval(PAGE_STATE))}`);
            return;
          }
          pass("the gate is present and the surface is absent before the tap");

          const gate = await guestPage.eval(GATE_STATE);
          if (gate === null) {
            fail(`${EL.gatePhase} did not render`);
            return;
          }
          info(`gate state line: "${gate.text}"`);
          if (gate.round === null || gate.phase === null || gate.characters !== 8) {
            fail(`the gate state line reads "${gate.text}", want "Round N · Draft · 8 characters"`);
          } else {
            pass(`the gate names the round and the cast: "${gate.text}"`);
          }
          gateRound = gate.round;

          const label = await guestPage.eval(`document.querySelector(${JSON.stringify(EL.enter)})?.textContent.trim() ?? null`);
          if (label === null || !/^Open (in fullscreen|the game)$/.test(label)) {
            fail(`the CTA label is ${JSON.stringify(label)}, want "Open in fullscreen" or "Open the game"`);
          } else {
            pass(`the CTA reads "${label}"`);
          }
          info(`screenshot: ${await guestPage.screenshot("citadels-gate")}`);
        },
      },
      {
        name: "a real click opens the surface in fullscreen",
        run: async () => {
          const hrefBefore = await guestPage.href();
          const clicked = await guestPage.clickElement(
            q(EL.enter),
            `!!document.querySelector(${JSON.stringify(EL.surface)})`,
          );
          if (!clicked) throw new Error("the CTA did not reveal the surface after a real CDP pointer click");
          pass("the surface appeared after a real CDP pointer click on the CTA");

          if (await guestPage.eval(`!!document.querySelector(${JSON.stringify(EL.gate)})`)) {
            fail("the gate is still in the document behind the surface");
          } else {
            pass("the gate is gone");
          }

          const fullscreen = await guestPage.waitFor("document.fullscreenElement !== null", { timeoutMs: 6000 });
          const holder = await guestPage.eval("document.fullscreenElement === null ? null : document.fullscreenElement.getAttribute('data-slot')");
          if (!fullscreen) {
            fail("the surface is up but document.fullscreenElement is null — the request rode no activation or the browser refused it");
          } else if (holder !== "citadels-immersive") {
            fail(`document.fullscreenElement carries data-slot=${JSON.stringify(holder)}, want the immersive root`);
          } else {
            pass("document.fullscreenElement is the immersive root");
          }

          if ((await guestPage.href()) !== hrefBefore) {
            fail(`the entry navigated: ${hrefBefore} -> ${await guestPage.href()}`);
          } else {
            pass(`the entry kept the route: ${hrefBefore}`);
          }

          landscape = await guestPage.eval(FACTS);
          if (landscape.orientation !== "landscape") {
            fail(`the surface reads data-orientation=${JSON.stringify(landscape.orientation)} at 1280x800`);
          } else {
            pass("the surface reads data-orientation=landscape at 1280x800");
          }
          info(`screenshot: ${await guestPage.screenshot("citadels-surface-landscape")}`);
        },
      },
      {
        name: "leaving fullscreen returns to the gate with the session intact",
        run: async () => {
          await guestPage.eval("document.exitFullscreen()");
          const back = await guestPage.waitFor(
            `${q(EL.gate)} && !document.querySelector(${JSON.stringify(EL.surface)})`,
            { timeoutMs: 10000 },
          );
          if (!back) {
            fail(`exiting fullscreen left href ${await guestPage.href()} without the gate (surface up: ${await guestPage.eval(`!!document.querySelector(${JSON.stringify(EL.surface)})`)})`);
            return;
          }
          pass("exitFullscreen() brought the gate back and removed the surface");

          const gate = await guestPage.eval(GATE_STATE);
          if (gate === null || gate.round !== gateRound) {
            fail(`the gate state line reads ${JSON.stringify(gate === null ? null : gate.text)}, want round ${gateRound}`);
          } else {
            pass(`the round line still reads "${gate.text}"`);
          }
          info(`screenshot: ${await guestPage.screenshot("citadels-surface-after-exit")}`);

          // A browser that declines the request must still land on the surface.
          await guestPage.eval(`(() => { window.__realRequestFullscreen = Element.prototype.requestFullscreen; window.__fullscreenAttempts = 0; Element.prototype.requestFullscreen = function () { window.__fullscreenAttempts += 1; return Promise.reject(new DOMException("denied", "NotAllowedError")); }; return true; })()`);
          const revealed = await guestPage.clickElement(
            q(EL.enter),
            `!!document.querySelector(${JSON.stringify(EL.surface)}) && !!document.querySelector(${JSON.stringify(EL.notice)})`,
          );
          if (!revealed) {
            fail("a refused request did not reveal the surface with a notice");
          } else {
            pass("a refused request still revealed the surface");
          }

          const notice = await guestPage.eval(`(() => { const el = document.querySelector(${JSON.stringify(EL.notice)}); if (el === null) return null; const r = el.getBoundingClientRect(); return { text: el.textContent.trim(), height: Math.round(r.height) }; })()`);
          if (notice === null || notice.height === 0) {
            fail(`${EL.notice} is ${JSON.stringify(notice)} — absent or zero-height`);
          } else {
            pass(`the surface carries the refusal notice "${notice.text}"`);
          }
          if (!(await guestPage.eval(`!!document.querySelector(${JSON.stringify(EL.retry)})`))) {
            fail(`${EL.retry} is missing on the refusal notice`);
          } else {
            pass("the refusal notice offers a retry");
          }

          const afterExit = await guestPage.eval(FACTS);
          if (landscape !== null) {
            const moved = landscape.seats.filter((seat, i) => JSON.stringify(seat) !== JSON.stringify(afterExit.seats[i] ?? null));
            if (moved.length > 0) {
              fail(`seats changed across the exit: ${JSON.stringify(moved.map((seat, i) => [seat, afterExit.seats[i]]))}`);
            } else {
              pass(`all ${landscape.seats.length} seats kept their gold and districts across the exit (${JSON.stringify(afterExit.seats)})`);
            }
          }
          info(`screenshot: ${await guestPage.screenshot("citadels-surface-refused")}`);

          const retried = await guestPage.clickElement(q(EL.retry), "window.__fullscreenAttempts >= 2");
          if (!retried) {
            fail("the retry control sent no second fullscreen request");
          } else {
            pass("the retry sent a second fullscreen request");
          }
          const stillThere = await guestPage.waitFor(
            `${q(EL.surface)} && ${q(EL.retry)}`,
            { timeoutMs: 4000 },
          );
          if (!stillThere) fail("the surface or its retry vanished after the retry");
          else pass("the surface is still up after the retry, with the retry control in place");

          await guestPage.eval("Element.prototype.requestFullscreen = window.__realRequestFullscreen; true");
          await guestPage.eval("document.fullscreenElement === null ? null : document.exitFullscreen()");
          const returned = await guestPage.clickElement(
            q(EL.exit),
            `${q(EL.gate)} && !document.querySelector(${JSON.stringify(EL.surface)})`,
          );
          if (!returned) throw new Error("the exit control did not return to the gate");
          pass("the exit control returned to the gate");
        },
      },
      {
        name: "rotation flips data-orientation and nothing else",
        run: async () => {
          const entered = await guestPage.clickElement(
            q(EL.enter),
            `!!document.querySelector(${JSON.stringify(EL.surface)})`,
          );
          if (!entered) throw new Error("the CTA did not re-open the surface");
          if (!(await guestPage.waitFor("document.fullscreenElement !== null", { timeoutMs: 6000 }))) {
            fail("the surface re-opened but fullscreen was not requested again");
          }
          await guestPage.eval(`(() => { window.__proofSurface = document.querySelector(${JSON.stringify(EL.surface)}); window.__proofSeats = [...document.querySelectorAll('[data-slot=citadels-seat]')]; return window.__proofSeats.length; })()`);

          const before = await guestPage.eval(FACTS);
          const layoutBefore = await guestPage.eval(LAYOUT);
          if (before.orientation !== "landscape") fail(`the surface reads data-orientation=${JSON.stringify(before.orientation)} before the rotation`);
          else pass(`rotating from a landscape surface with ${before.seats.length} seats and ${before.hand} cards in hand`);

          await guestPage.setOrientation({ width: 390, height: 844, type: "portraitPrimary", angle: 0 });
          const portrait = await guestPage.waitFor(
            `${q(EL.surface)}.getAttribute('data-orientation') === 'portrait'`,
            { timeoutMs: 6000 },
          );
          if (!portrait) {
            fail(`the surface still reads data-orientation=${JSON.stringify(await guestPage.eval(`${q(EL.surface)}.getAttribute('data-orientation')`))} at 390x844`);
          } else {
            pass("the surface reads data-orientation=portrait at 390x844");
          }
          info(`screenshot: ${await guestPage.screenshot("citadels-surface-portrait")}`);

          const inPortrait = await guestPage.eval(FACTS);
          const portraitDiffs = factDiffs(before, inPortrait);
          const layoutPortrait = await guestPage.eval(LAYOUT);
          if (layoutPortrait === null || layoutBefore === null) {
            fail("the board or the rivals region is missing, so the rotation had nothing to reflow");
          } else if (layoutPortrait.columns === layoutBefore.columns && layoutPortrait.opponents === layoutBefore.opponents) {
            fail(`portrait reflowed nothing: the board is still ${layoutBefore.columns} and the rivals region still ${layoutBefore.opponents}`);
          } else {
            pass(`portrait reflowed the board (${layoutBefore.columns} -> ${layoutPortrait.columns}, rivals ${layoutBefore.opponents} -> ${layoutPortrait.opponents})`);
          }
          if (portraitDiffs.length > 0) fail(`portrait changed ${portraitDiffs.join("; ")}`);
          else pass(`portrait kept the round, all ${inPortrait.seats.length} seats, and ${inPortrait.hand} cards in hand`);

          const remounted = await guestPage.eval("!window.__proofSurface.isConnected || window.__proofSurface !== document.querySelector('[data-slot=citadels-surface]')");
          if (remounted) fail("the surface node was replaced by the rotation");
          else pass("the surface node survived the rotation");

          await guestPage.setOrientation({ width: 1280, height: 800, type: "landscapePrimary", angle: 0 });
          const back = await guestPage.waitFor(
            `${q(EL.surface)}.getAttribute('data-orientation') === 'landscape'`,
            { timeoutMs: 6000 },
          );
          if (!back) {
            fail(`the surface reads data-orientation=${JSON.stringify(await guestPage.eval(`${q(EL.surface)}.getAttribute('data-orientation')`))} back at 1280x800`);
          } else {
            pass("the surface reads data-orientation=landscape back at 1280x800");
          }
          const rotatedBack = await guestPage.eval(FACTS);
          const backDiffs = factDiffs(before, rotatedBack);
          if (backDiffs.length > 0) fail(`the round trip changed ${backDiffs.join("; ")}`);
          else pass("the round trip kept the round, every seat, and the hand");
          const seatsKept = await guestPage.eval("window.__proofSeats.every((seat) => seat.isConnected)");
          if (!seatsKept) fail("a seat node was replaced by the rotation");
          else pass(`all ${before.seats.length} seat nodes survived both rotations`);
        },
      },
      {
        name: "a g54 room on the same route still renders its own board",
        run: async () => {
          const g54 = await createRoomThroughApi(host, { name: "G54 surface proof", seats: 2, setup: { game: "g54", roles: G54_ROLES } });
          await joinThroughLink(otherPage, g54);
          await startThroughLobby(hostPage, g54);
          await openRoute(hostPage, `${BASE}/games/${g54}`);
          const board = await hostPage.waitFor("!!document.querySelector('[data-slot=game-board]')", { timeoutMs: 90000 });
          const gate = await hostPage.eval(`!!document.querySelector(${JSON.stringify(EL.gate)})`);
          const surface = await hostPage.eval(`!!document.querySelector(${JSON.stringify(EL.surface)})`);
          if (!board) fail(`the g54 room ${g54} rendered no [data-slot=game-board]`);
          else pass(`the g54 room ${g54} renders its own board`);
          if (gate) fail("a g54 game shows the citadels gate");
          else pass("a g54 game shows no citadels gate");
          if (surface) fail("a g54 game shows the citadels surface");
          else pass("a g54 game shows no citadels surface");
        },
      },
    ];

    await runBeats(beats);

    console.log("");
    if (failures.length > 0) {
      console.error(`${failures.length} check(s) failed`);
      for (const failure of failures) console.error(`- ${failure}`);
    } else {
      console.log("all citadels surface proof checks passed");
    }
  } finally {
    for (const browser of browsers) browser.close();
    if (server !== null) {
      try {
        process.kill(-server.pid, "SIGKILL");
      } catch {}
    }
  }
  process.exit(failures.length === 0 ? 0 : 1);
};

main().catch((error) => {
  console.error("PROOF ERROR:", error);
  process.exit(2);
});
