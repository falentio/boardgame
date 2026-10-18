// Proof for the four turn controls: the demo harness renders them, and on the
// live game surface the same controls sit in the self column's action slot,
// where a real click lands on the session.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const BASE = "http://localhost:3000";
const HARNESS = BASE + "/dev/actions-demo";
const OUT = ".audit/actions";
const STAMP = Date.now();
const PASSWORD = "proof-password-123";
const CAST = ["assassin", "thief", "magician", "king", "bishop", "merchant", "architect", "warlord"];
const VIEWPORT = { width: 1280, height: 800 };
const RULE = "rgb(230, 219, 116)";

mkdirSync(OUT, { recursive: true });

const fails = [];
const info = (msg) => console.log("INFO " + msg);
const check = (ok, label, detail) => {
  console.log((ok ? "PASS " : "FAIL ") + label + (detail === undefined ? "" : " :: " + JSON.stringify(detail)));
  if (!ok) fails.push(label);
};

/** A page probe written as a function, so the selector and the strings survive untouched. */
const expr = (fn) => "(" + fn.toString() + ")()";

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });

const launch = async (label) => {
  const port = await freePort();
  const profile = "/tmp/actions-" + label + "-" + STAMP;
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(
    "/usr/bin/google-chrome",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--user-data-dir=" + profile,
      "--remote-debugging-port=" + port,
      "--remote-allow-origins=*",
      "about:blank",
    ],
    { stdio: "ignore", detached: true },
  );
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i++) {
    try {
      const res = await fetch("http://127.0.0.1:" + port + "/json/version");
      if (res.ok) wsUrl = (await res.json()).webSocketDebuggerUrl;
    } catch {}
    if (!wsUrl) await delay(250);
  }
  if (!wsUrl) throw new Error(label + ": chrome never exposed a debug endpoint");

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    } else if (message.method === "Runtime.exceptionThrown") {
      errors.push(message.params.exceptionDetails.text);
    } else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      errors.push(message.params.args.map((a) => a.value || a.description).join(" "));
    }
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });
  const target = (await send("Target.createTarget", { url: "about:blank" })).result;
  const session = (await send("Target.attachToTarget", { targetId: target.targetId, flatten: true })).result.sessionId;
  await send("Page.enable", {}, session);
  await send("Runtime.enable", {}, session);
  await send("Network.enable", {}, session);
  await send("Emulation.setDeviceMetricsOverride", { ...VIEWPORT, deviceScaleFactor: 2, mobile: false }, session);

  const page = {
    label,
    errors,
    async setCookie(user) {
      await send("Network.setCookie", { url: BASE, name: user.cookieName, value: user.cookieValue }, session);
    },
    async goto(url, waitMs = 2500) {
      await send("Page.navigate", { url }, session);
      await delay(waitMs);
    },
    async eval(expression) {
      const message = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, session);
      if (message.result && message.result.exceptionDetails) {
        throw new Error(label + " eval threw: " + message.result.exceptionDetails.text);
      }
      return message.result && message.result.result ? message.result.result.value : undefined;
    },
    async waitFor(expression, timeoutMs = 30000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        if (await page.eval("!!(" + expression + ")")) return true;
        if (Date.now() >= deadline) return false;
        await delay(250);
      }
    },
    async click(selector) {
      return page.eval(
        "(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (el === null) return false; el.click(); return true; })()",
      );
    },
    async rect(selector) {
      return page.eval(
        "(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (el === null) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()",
      );
    },
    async hover(selector) {
      const box = await page.rect(selector);
      if (box === null) return null;
      const x = Math.round(box.x + box.width / 2);
      const y = Math.round(box.y + box.height / 2);
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 }, session);
      await delay(300);
      return page.eval(
        "(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); const style = getComputedStyle(el); return { translate: style.translate, border: style.borderTopColor, hovered: el.matches(':hover') }; })()",
      );
    },
    async shot(name) {
      const res = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, session);
      const path = OUT + "/" + name + ".png";
      writeFileSync(path, Buffer.from(res.result.data, "base64"));
      return path;
    },
    async clip(name, selector, pad = 8) {
      const box = await page.rect(selector);
      if (box === null) return null;
      const x = Math.max(0, box.x - pad);
      const y = Math.max(0, box.y - pad);
      const width = Math.min(VIEWPORT.width - x, box.width + pad * 2);
      const height = Math.min(VIEWPORT.height - y, box.height + pad * 2);
      const res = await send(
        "Page.captureScreenshot",
        { format: "png", fromSurface: true, clip: { x, y, width, height, scale: 2 } },
        session,
      );
      const path = OUT + "/" + name + ".png";
      writeFileSync(path, Buffer.from(res.result.data, "base64"));
      return path;
    },
    close() {
      try {
        ws.close();
      } catch {}
      try {
        process.kill(-chrome.pid);
      } catch {
        try {
          chrome.kill("SIGKILL");
        } catch {}
      }
      try {
        rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };
  return page;
};

const signUp = async (label) => {
  const email = "actions-" + label + "-" + STAMP + "@example.com";
  const res = await fetch(BASE + "/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name: label }),
  });
  const body = await res.text();
  if (res.status !== 200) throw new Error("sign-up " + label + " returned " + res.status + ": " + body.slice(0, 200));
  const user = JSON.parse(body).user;
  const cookie = res.headers.get("set-cookie");
  if (cookie === null) throw new Error("sign-up " + label + " set no cookie");
  const pair = cookie.split(";")[0];
  const at = pair.indexOf("=");
  return { label, email, id: user.id, cookie: pair, cookieName: pair.slice(0, at), cookieValue: pair.slice(at + 1) };
};

const createRoom = async (host) => {
  const res = await fetch(BASE + "/api/rooms", {
    method: "POST",
    headers: { origin: BASE, cookie: host.cookie, "content-type": "application/json" },
    body: JSON.stringify({ name: "Actions live proof", seats: 2, setup: { game: "citadels", cast: CAST } }),
  });
  if (res.status !== 201) throw new Error("create room returned " + res.status + ": " + (await res.text()).slice(0, 200));
  return (await res.json()).room.code;
};

const runHarness = async () => {
  const page = await launch("harness");
  try {
    await page.goto(HARNESS, 2600);

    const shape = await page.eval(
      expr(function () {
        const at = (name) =>
          [...document.querySelectorAll("[data-demo=" + name + "] [data-slot=citadels-action]")].map((b) => ({
            action: b.getAttribute("data-action"),
            tag: b.tagName,
            disabled: b.disabled,
          }));
        const opens = (name) => document.querySelector("[data-demo=" + name + "] [data-slot=citadels-actions]") !== null;
        return {
          twoCards: at("two-cards"),
          noCards: at("no-cards"),
          otherWindow: opens("other-window"),
          rivalWindow: opens("rival-window"),
          noWindow: opens("no-window"),
        };
      }),
    );
    console.log("shape:", JSON.stringify(shape));
    check(JSON.stringify(shape.twoCards.map((b) => b.action)) === JSON.stringify(["gold", "draw", "build", "pass"]), "four controls in order (gold, draw, build, pass)", shape.twoCards.map((b) => b.action));
    check(shape.twoCards.every((b) => b.tag === "BUTTON"), "each control is a real <button>", shape.twoCards.map((b) => b.tag));
    check(shape.twoCards.every((b) => b.disabled === false), "two-card hand: all four enabled", shape.twoCards);
    check(JSON.stringify(shape.noCards.map((b) => b.action)) === JSON.stringify(["gold", "draw", "build", "pass"]), "empty hand still renders all four", shape.noCards.map((b) => b.action));
    check(JSON.stringify(shape.noCards.filter((b) => b.disabled).map((b) => b.action)) === JSON.stringify(["build"]), "empty hand: only build disabled", shape.noCards.filter((b) => b.disabled).map((b) => b.action));
    check(shape.otherWindow === false, "keep window renders nothing", shape.otherWindow);
    check(shape.rivalWindow === false, "turn window owed by a rival renders nothing", shape.rivalWindow);
    check(shape.noWindow === false, "no window renders nothing", shape.noWindow);

    console.log("shot:", await page.shot("harness-turn-window"));

    const clicks = await page.eval(
      expr(function () {
        return (async () => {
          const out = [];
          for (const action of ["gold", "draw", "build", "pass"]) {
            const button = document.querySelector("[data-demo=two-cards] [data-action=" + action + "]");
            button.click();
            await new Promise((r) => setTimeout(r, 60));
            out.push({ action, emitted: JSON.parse(JSON.stringify((window.__emitted || []).slice(-1)[0] || null)) });
          }
          const build = document.querySelector("[data-demo=no-cards] [data-action=build]");
          build.click();
          await new Promise((r) => setTimeout(r, 60));
          return { clicks: out, afterDisabledBuildClick: (window.__emitted || []).length };
        })();
      }),
    );
    console.log("clicks:", JSON.stringify(clicks.clicks));
    check(JSON.stringify(clicks.clicks.map((c) => c.action)) === JSON.stringify(["gold", "draw", "build", "pass"]), "clicked all four controls", clicks.clicks.map((c) => c.action));
    check(JSON.stringify(clicks.clicks.map((c) => c.emitted)) === JSON.stringify([{ t: "gold" }, { t: "draw" }, { t: "build", card: 0 }, { t: "pass" }]), "each click emitted its domain action", clicks.clicks.map((c) => c.emitted));
    check(clicks.afterDisabledBuildClick === 4, "disabled build in an empty hand emits nothing", clicks.afterDisabledBuildClick);

    const a11y = await page.eval(
      expr(function () {
        const button = document.querySelector("[data-demo=no-cards] [data-action=build]");
        const box = document.querySelector("[data-demo=two-cards] [data-slot=citadels-actions]");
        return { title: button.getAttribute("title"), text: button.textContent.trim(), list: box.getAttribute("aria-label") };
      }),
    );
    console.log("a11y:", JSON.stringify(a11y));

    const row = await page.eval(
      expr(function () {
        const buttons = [...document.querySelectorAll("[data-demo=two-cards] [data-action]")].map((b) => {
          const box = b.getBoundingClientRect();
          return { action: b.getAttribute("data-action"), x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) };
        });
        const slot = document.querySelector("[data-demo=two-cards] [data-slot=citadels-actions]").getBoundingClientRect();
        return { x: Math.round(slot.x), y: Math.round(slot.y), w: Math.round(slot.width), h: Math.round(slot.height), buttons };
      }),
    );
    console.log("layout:", JSON.stringify(row));
    check(row.buttons.every((c) => c.h > 0 && c.w > 0), "every control has a non-zero box", row.buttons);
    check(row.buttons.every((c) => c.y === row.buttons[0].y), "the four controls sit on one row", row.buttons.map((c) => c.y));
  } finally {
    console.log("harness console errors:", page.errors.length ? page.errors.slice(0, 3) : "none");
    page.close();
  }
};

const ACTIONS = function () {
  const box = document.querySelector("[data-slot=citadels-surface] [data-slot=citadels-actions]");
  return box === null ? null : [...box.querySelectorAll("[data-slot=citadels-action]")].map((b) => b.getAttribute("data-action"));
};

const runLiveSurface = async () => {
  const host = await signUp("host");
  const guest = await signUp("guest");
  const code = await createRoom(host);
  info("room " + code + " (citadels, 2 seats)");
  const hostPage = await launch("host");
  const guestPage = await launch("guest");
  try {
    await hostPage.setCookie(host);
    await guestPage.setCookie(guest);

    await guestPage.goto(BASE + "/join/" + code, 1500);
    const seated = await guestPage.waitFor("location.pathname === '/rooms/" + code + "'", 40000);
    check(seated, "the second account takes the spare seat", await guestPage.eval("location.pathname"));

    await hostPage.goto(BASE + "/rooms/" + code, 1500);
    const full = await hostPage.waitFor("document.body.innerText.includes('All seats filled')", 40000);
    check(full, "the room reports all seats filled");
    await hostPage.eval("(() => { const b = [...document.querySelectorAll('button')].find((el) => el.textContent.includes('Start game')); if (b) b.click(); return b !== undefined; })()");
    const started = await hostPage.waitFor("location.pathname === '/games/" + code + "'", 40000);
    check(started, "the host's start opens the game route", await hostPage.eval("location.pathname"));

    for (const page of [hostPage, guestPage]) {
      await page.goto(BASE + "/games/" + code, 2500);
      const immersive = await page.waitFor("document.querySelector('[data-slot=citadels-immersive]')", 60000);
      check(immersive, page.label + ": the citadels screen mounts on the game route");
      await page.click("[data-slot=citadels-enter]");
      const surface = await page.waitFor("document.querySelector('[data-slot=citadels-surface]')", 20000);
      check(surface, page.label + ": the enter control reveals the game surface");
    }

    // Each draft window owes one page a pick; the first unlocked card is the
    // lowest rank still free, so both seats walk the cast from the bottom up.
    const pickIfOwed = async (page) => {
      const free = await page.eval(expr(function () {
        return document.querySelector("[data-slot=citadels-picker-card]:not([disabled])") !== null;
      }));
      if (!free) return false;
      const character = await page.eval(expr(function () {
        const card = document.querySelector("[data-slot=citadels-picker-card]:not([disabled])");
        card.click();
        return card.getAttribute("data-character");
      }));
      await delay(250);
      const confirmed = await page.click("[data-slot=citadels-picker-confirm]");
      info(page.label + " drafted " + character + " (confirmed: " + confirmed + ")");
      await delay(400);
      return true;
    };

    const deadline = Date.now() + 240000;
    let live = null;
    let rivalSawActions = null;
    while (Date.now() < deadline && live === null) {
      if (await pickIfOwed(hostPage)) continue;
      if (await pickIfOwed(guestPage)) continue;
      const mine = await hostPage.eval(expr(ACTIONS));
      if (mine !== null) {
        live = mine;
        rivalSawActions = await guestPage.eval(expr(ACTIONS));
        break;
      }
      const theirs = await guestPage.eval(expr(ACTIONS));
      if (theirs !== null) {
        await guestPage.click("[data-slot=citadels-surface] [data-action=pass]");
        info("the rival's turn window passed on; waiting for mine");
        await delay(600);
        continue;
      }
      await delay(400);
    }

    check(live !== null, "the live surface opens the four controls on my turn window", live);
    if (live === null) {
      console.log(
        "live querySelector:",
        JSON.stringify(
          await hostPage.eval(expr(function () {
            return {
              path: location.pathname,
              turn: document.querySelector("[data-slot=citadels-window]") ? document.querySelector("[data-slot=citadels-window]").textContent.trim() : null,
              board: document.querySelector("[data-slot=citadels-board]") !== null,
              actions: document.querySelector("[data-slot=citadels-surface] [data-slot=citadels-actions]") !== null,
            };
          })),
        ),
      );
      return;
    }

    const proof = await hostPage.eval(
      expr(function () {
        const box = document.querySelector("[data-slot=citadels-surface] [data-slot=citadels-actions]");
        const buttons = box === null ? [] : [...box.querySelectorAll("[data-slot=citadels-action]")];
        const self = document.querySelector("[data-slot=citadels-self]");
        return {
          surface: document.querySelector("[data-slot=citadels-surface]") !== null,
          box: box !== null,
          inSelfColumn: box !== null && self !== null && self.contains(box),
          ariaLabel: box === null ? null : box.getAttribute("aria-label"),
          count: buttons.length,
          actions: buttons.map((b) => b.getAttribute("data-action")),
          tags: buttons.map((b) => b.tagName),
          labels: buttons.map((b) => b.textContent.trim()),
          radius: buttons.map((b) => getComputedStyle(b).borderTopLeftRadius),
        };
      }),
    );
    console.log("live querySelector:", JSON.stringify(proof));
    check(proof.surface, "the live game surface is on screen");
    check(proof.box, "document.querySelector('[data-slot=citadels-surface] [data-slot=citadels-actions]') is non-null");
    check(proof.inSelfColumn, "the action slot sits inside the self column");
    check(proof.count === 4, "the action slot holds four [data-slot=citadels-action] elements", proof.count);
    check(JSON.stringify(proof.actions) === JSON.stringify(["gold", "draw", "build", "pass"]), "the four live controls are gold, draw, build, pass", proof.actions);
    check(proof.tags.every((tag) => tag === "BUTTON"), "every live control is a real <button>", proof.tags);
    check(proof.radius.every((r) => r === "0px"), "every live control has square corners", proof.radius);
    check(rivalSawActions === null, "the rival's surface renders no turn control while mine owes the turn", rivalSawActions);

    const hover = await hostPage.hover("[data-slot=citadels-surface] [data-action=gold]");
    console.log("live hover:", JSON.stringify(hover));
    check(hover !== null && hover.translate === "0px -1px" && hover.border === RULE, "the live control lifts 1px and takes the yellow frame ink on hover", hover);

    console.log("self column:", await hostPage.clip("self-column", "[data-slot=citadels-self]", 10));
    console.log("surface:", await hostPage.shot("live-surface"));

    const gold = await hostPage.eval(
      expr(function () {
        return (async () => {
          const read = () => {
            const plate = document.querySelector("[data-slot=citadels-self-gold]");
            return plate === null ? null : plate.textContent.trim();
          };
          const before = read();
          document.querySelector("[data-slot=citadels-surface] [data-action=gold]").click();
          await new Promise((r) => setTimeout(r, 900));
          const window = document.querySelector("[data-slot=citadels-window]");
          return {
            before,
            after: read(),
            boardAfter: document.querySelector("[data-slot=citadels-board]") !== null,
            windowAfter: window === null ? null : window.textContent.trim(),
            stillOpen: document.querySelector("[data-slot=citadels-surface] [data-slot=citadels-actions]") !== null,
          };
        })();
      }),
    );
    console.log("gold gather:", JSON.stringify(gold));
    check(gold.before !== null && gold.after === String(Number(gold.before) + 2), "the gold control reports through the session and banks 2 gold", gold);
    check(gold.boardAfter === true, "the board stays mounted through the gather");
    // The tiles ride the turn window alone. After the gather the stack can hand the
    // seat its own ability window (a thief robs before it builds), where the tiles
    // stand down by design; which of the two the run lands on is the reducer's call.
    info("window after the gather: " + gold.windowAfter + " (tiles " + (gold.stillOpen ? "up on the build window" : "down for the character's window") + ")");
    console.log("self column after gold:", await hostPage.clip("self-column-after-gold", "[data-slot=citadels-self]", 10));
  } finally {
    console.log("live console errors:", hostPage.errors.length ? hostPage.errors.slice(0, 3) : "none", guestPage.errors.length ? guestPage.errors.slice(0, 3) : "none");
    hostPage.close();
    guestPage.close();
  }
};

await runHarness();
await runLiveSurface();
console.log(fails.length === 0 ? "ALL CHECKS PASS" : fails.length + " CHECK(S) FAILED");
console.log("failed:", JSON.stringify(fails));
process.exitCode = fails.length === 0 ? 0 : 1;
