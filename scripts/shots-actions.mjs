// Proof for the four turn controls: the demo harness renders them, and on the
// live game surface the same controls sit in the self column's action slot,
// where a real click lands on the session.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const BASE = process.env.CITADELS_BASE ?? "http://localhost:3000";
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
      // Headless Chrome reports no hover media at all, so the 1px lift behind
      // (hover: hover) and (pointer: fine) never applies without a reported
      // pointer. Emulation.setEmulatedMedia takes these features and does
      // nothing with them; the blink setting is what makes the media match.
      "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4",
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
    /** A click before the client script has taken the DOM over reaches no listener. */
    hydrated: (timeoutMs = 60000) =>
      page.waitFor("document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__", timeoutMs),
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
    async clickReal(selector, attempts = 6) {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        // A real press lands where the pointer is, so the target has to be on screen.
        await page.eval(
          "(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (el !== null) el.scrollIntoView({ block: 'center', inline: 'center' }); return el !== null; })()",
        );
        const box = await page.rect(selector);
        if (box !== null) {
          const x = Math.round(box.x + box.width / 2);
          const y = Math.round(box.y + box.height / 2);
          await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, buttons: 0 }, session);
          await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", buttons: 1, clickCount: 1 }, session);
          await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", buttons: 0, clickCount: 1 }, session);
          return true;
        }
        await delay(120);
      }
      return false;
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
    check(await page.hydrated(), "the demo page's client script runs before the probe reads it");

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
          pickedCard: at("picked-card"),
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
    check(JSON.stringify(shape.twoCards.filter((b) => !b.disabled).map((b) => b.action)) === JSON.stringify(["gold", "draw", "pass"]), "two-card hand: build waits for a hand card to be picked", shape.twoCards);
    check(shape.pickedCard.every((b) => b.disabled === false), "a picked hand card arms all four controls", shape.pickedCard);
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
            const before = (window.__emitted || []).length;
            button.click();
            await new Promise((r) => setTimeout(r, 60));
            const after = window.__emitted || [];
            out.push({ action, emitted: after.length > before ? JSON.parse(JSON.stringify(after[after.length - 1])) : null });
          }
          const reported = (window.__emitted || []).length;
          const picked = document.querySelector("[data-demo=picked-card] [data-action=build]");
          picked.click();
          await new Promise((r) => setTimeout(r, 60));
          const built = JSON.parse(JSON.stringify((window.__emitted || []).slice(-1)[0] || null));
          const build = document.querySelector("[data-demo=no-cards] [data-action=build]");
          build.click();
          await new Promise((r) => setTimeout(r, 60));
          return { clicks: out, reported, built, afterDisabledBuildClick: (window.__emitted || []).length };
        })();
      }),
    );
    console.log("clicks:", JSON.stringify(clicks.clicks));
    check(JSON.stringify(clicks.clicks.map((c) => c.action)) === JSON.stringify(["gold", "draw", "build", "pass"]), "clicked all four controls", clicks.clicks.map((c) => c.action));
    check(JSON.stringify(clicks.clicks.map((c) => c.emitted)) === JSON.stringify([{ t: "gold" }, { t: "draw" }, null, { t: "pass" }]), "gold, draw and pass report; an unpicked build reports nothing", clicks.clicks.map((c) => c.emitted));
    check(JSON.stringify(clicks.built) === JSON.stringify({ t: "build", card: 1 }), "a build reports the hand index it was told, not the first card", clicks.built);
    check(clicks.afterDisabledBuildClick === clicks.reported + 1, "the empty hand and the unpicked build emit nothing", { reported: clicks.reported, after: clicks.afterDisabledBuildClick });

    const a11y = await page.eval(
      expr(function () {
        const button = document.querySelector("[data-demo=two-cards] [data-action=build]");
        const empty = document.querySelector("[data-demo=no-cards] [data-action=build]");
        const box = document.querySelector("[data-demo=two-cards] [data-slot=citadels-actions]");
        return { title: button.getAttribute("title"), emptyTitle: empty.getAttribute("title"), text: button.textContent.trim(), list: box.getAttribute("aria-label") };
      }),
    );
    console.log("a11y:", JSON.stringify(a11y));
    check(a11y.title !== null && a11y.title.includes("Pick a card") && a11y.title !== a11y.emptyTitle, "the unpicked build names the card it waits for", { unpicked: a11y.title, emptyHand: a11y.emptyTitle });

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
    check(await guestPage.hydrated(), "the guest's join page runs its client script, which is what takes the seat");
    const seated = await guestPage.waitFor("location.pathname === '/rooms/" + code + "'", 40000);
    check(seated, "the second account takes the spare seat", await guestPage.eval("location.pathname"));

    await hostPage.goto(BASE + "/rooms/" + code, 1500);
    check(await hostPage.hydrated(), "the host's room page runs the client script that fetches the seats");
    const full = await hostPage.waitFor("document.body.innerText.includes('All seats filled')", 40000);
    check(full, "the room reports all seats filled");
    const offered = await hostPage.eval(
      "(() => { const b = [...document.querySelectorAll('button')].find((el) => el.textContent.includes('Start game')); if (b === undefined) return false; b.click(); return true; })()",
    );
    check(offered, "the host's room page draws the start control, and it takes the click");
    const started = await hostPage.waitFor("location.pathname === '/games/" + code + "'", 40000);
    check(started, "the host's start opens the game route", await hostPage.eval("location.pathname"));

    for (const page of [hostPage, guestPage]) {
      await page.goto(BASE + "/games/" + code, 2500);
      check(await page.hydrated(), page.label + ": the game page runs the client script behind the enter control");
      const immersive = await page.waitFor("document.querySelector('[data-slot=citadels-immersive]')", 60000);
      check(immersive, page.label + ": the citadels screen mounts on the game route");
      await page.click("[data-slot=citadels-enter]");
      const surface = await page.waitFor("document.querySelector('[data-slot=citadels-surface]')", 20000);
      check(surface, page.label + ": the enter control reveals the game surface");
    }

    // Each draft window owes one page a pick; the first unlocked card is the
    // lowest rank still free, so both seats walk the cast from the bottom up.
    /** The build proof reads the hand right after the gather, so this seat prefers a
        character whose own effect opens no window between its gather and its build. */
    const NO_PRE_BUILD_WINDOW = ["architect", "bishop", "merchant", "king"];
    const pickIfOwed = async (page, prefer = []) => {
      const free = await page.eval(expr(function () {
        return document.querySelector("[data-slot=citadels-picker-card]:not([disabled])") !== null;
      }));
      if (!free) return false;
      const character = await page.eval(
        "(() => {" +
          " const open = [...document.querySelectorAll('[data-slot=citadels-picker-card]:not([disabled])')];" +
          " const prefer = " + JSON.stringify(prefer) + ";" +
          " const card = open.find((one) => prefer.includes(one.getAttribute('data-character'))) || open[0];" +
          " card.click();" +
          " return card.getAttribute('data-character');" +
          "})()",
      );
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
      if (await pickIfOwed(hostPage, NO_PRE_BUILD_WINDOW)) continue;
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
    const HAND = expr(function () {
      return [...document.querySelectorAll("[data-slot=citadels-hand-tile]")].map((tile) => {
        const card = tile.querySelector("[data-slot=citadels-district]");
        const label = card === null ? "" : card.getAttribute("aria-label") || "";
        return {
          index: Number(tile.getAttribute("data-index")),
          district: card === null ? null : card.getAttribute("data-district"),
          name: label.split(",")[0],
          cost: Number((label.match(/, (\d+) gold/) || [])[1] || NaN),
          disabled: tile.disabled,
        };
      });
    });
    const STATE = expr(function () {
      const window = document.querySelector("[data-slot=citadels-window]");
      const choice = document.querySelector("[data-slot=citadels-choice]");
      const build = document.querySelector("[data-slot=citadels-actions] [data-action=build]");
      const gold = document.querySelector("[data-slot=citadels-self-gold]");
      return {
        window: window === null ? null : window.textContent.trim(),
        choice: choice === null ? null : choice.querySelectorAll("[data-slot=citadels-choice-option]").length,
        armed: build !== null && build.disabled === false,
        marked: document.querySelectorAll("[data-slot=citadels-hand-tile][data-picked=true]").length,
        hand: document.querySelectorAll("[data-slot=citadels-hand-tile]").length,
        handIds: [
          ...document.querySelectorAll("[data-slot=citadels-hand-tile] [data-slot=citadels-district]"),
        ].map((card) => card.getAttribute("data-district")),
        gold: gold === null ? null : Number(gold.textContent.trim()),
        city: [
          ...document.querySelectorAll(
            "[data-slot=citadels-self] [data-slot=citadels-city] [data-slot=citadels-district]",
          ),
        ].map((card) => card.getAttribute("data-district")),
      };
    });

    // A character's own effect can open a window between the gather and the build
    // (the draft below prefers a character that opens none), and such a window takes
    // a real press to answer, so answer it until the hand comes back pickable.
    const barrier = Date.now() + 25000;
    let hand = await hostPage.eval(HAND);
    while ((hand.length === 0 || hand[0].disabled) && Date.now() < barrier) {
      await hostPage.clickReal("[data-slot=citadels-surface] [data-slot=citadels-choice-option]");
      await delay(280);
      hand = await hostPage.eval(HAND);
    }
    const before = await hostPage.eval(STATE);
    const affordable = hand.filter((card) => Number.isFinite(card.cost) && card.cost <= before.gold);
    const picked = affordable.find((card) => card.index !== 0) ?? affordable[0] ?? null;

    check(picked !== null, "the turn hand holds a card the gather's gold covers", { hand, gold: before.gold });
    if (picked !== null) {
      await hostPage.click('[data-slot=citadels-hand-tile][data-index="' + picked.index + '"]');
      await delay(150);
      const armed = await hostPage.eval(STATE);
      check(
        armed.marked === 1 && armed.armed,
        "picking hand index " + picked.index + " marks that tile and arms the turn bar's build",
        { marked: armed.marked, armed: armed.armed, picked },
      );
      await hostPage.click("[data-slot=citadels-actions] [data-action=build]");
      await delay(1800);
      const after = await hostPage.eval(STATE);
      console.log(
        "live build:",
        JSON.stringify({
          handBefore: hand,
          handAfter: after.hand,
          goldBefore: before.gold,
          goldAfter: after.gold,
          pickedIndex: picked.index,
          picked: picked.district,
          pickedCost: picked.cost,
          cityBefore: before.city,
          cityAfter: after.city,
          windowAfter: after.window,
        }),
      );
      check(after.city.includes(picked.district), "the engine builds the district the picked index names", { picked, city: after.city });
      // A character's own build bonus can draw on top of the build (the Architect draws
      // two), so the proof reads the picked card out of the hand rather than the count.
      const left =
        before.handIds.filter((id) => id === picked.district).length -
        after.handIds.filter((id) => id === picked.district).length;
      check(
        after.gold === before.gold - picked.cost && left === 1,
        "the build pays that card's cost and takes that card out of hand",
        { gold: before.gold + " -> " + after.gold, picked: picked.district, leftHand: left, handAfter: after.handIds },
      );
    }
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
