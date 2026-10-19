import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

export const PASSWORD = "proof-password-123";
export const CAST = ["assassin", "thief", "magician", "king", "bishop", "merchant", "architect", "warlord"];
export const RULE = "rgb(230, 219, 116)";

// Headless Chrome reports no hover media at all, so the 1px lift behind
// (hover: hover) and (pointer: fine) never applies without a reported pointer.
// Emulation.setEmulatedMedia takes these features and does nothing with them;
// the blink setting is what makes the media match.
export const FINE_POINTER_FLAGS = "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4";

export const argOf = (args, name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};

/** The harness is worth what its origin answers before the first check. */
export const serverAnswers = async (base) => {
  try {
    return (await fetch(base + "/api/auth/ok")).ok;
  } catch {
    return false;
  }
};

/** A flag nobody reads is a run that did not happen, so an unknown one stops the script. */
export const checkedArgs = (args, known) => {
  const unknown = args.filter((arg) => arg.startsWith("-") && !known.includes(arg));
  if (unknown.length > 0) throw new Error("unknown flag " + unknown.join(" ") + "; this script reads " + known.join(" "));
  return args;
};

/** --port and CITADELS_BASE name the origin; both at once name two, and nobody picks one silently. */
export const originOf = (args, { defaultPort, env = process.env }) => {
  const named = env.CITADELS_BASE ?? null;
  const flag = argOf(args, "--port", null);
  if (named !== null && flag !== null) throw new Error("--port " + flag + " and CITADELS_BASE=" + named + " both name an origin; pass one");
  if (named !== null) return named;
  const port = Number(flag ?? defaultPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("port " + JSON.stringify(flag ?? defaultPort) + " is not a port");
  return "http://localhost:" + port;
};

/** An every() over no items is true, so a list of controls read from a page that drew none has to fail on its own. */
export const every = (items, predicate) => items.length > 0 && items.every(predicate);

export const summarize = (failed) => (failed === 0 ? "ALL CHECKS PASS" : failed + " CHECK(S) FAILED");

/**
 * A check that stops running lowers a mode's count, so every mode declares the
 * count it must run; this line fails the mode that ran a different number.
 */
export const expectChecks = (ran, mode, ...expected) => {
  const matches = expected.includes(ran);
  console.log(
    (matches ? "PASS " : "FAIL ") +
      "the " + mode + " mode runs " + (expected.length === 1 ? expected[0] : expected.join(" or ")) + " checks" +
      (matches ? "" : " :: ran " + ran),
  );
  return matches;
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });

export const createShots = ({ name, base, out, viewport, detail = "text" }) => {
  const stamp = Date.now();
  const failures = [];
  let checks = 0;
  let answered = 0;
  let launched = 0;
  /** Event hooks, so a script that needs a Chrome event (a screencast frame) can take it. */
  const hooks = new Map();
  const on = (method, handler) => {
    hooks.set(method, [...(hooks.get(method) ?? []), handler]);
  };

  const check = (ok, label, value) => {
    checks += 1;
    console.log((ok ? "PASS " : "FAIL ") + label + (value === undefined ? "" : " :: " + (detail === "json" ? JSON.stringify(value) : value)));
    if (!ok) failures.push(label);
  };
  const info = (label, value) => console.log("INFO " + label + (value === undefined ? "" : " :: " + value));

  const launch = async ({ label = "page", debugPort, finePointer = false, windowSize } = {}) => {
    const port = debugPort ?? (await freePort());
    const profile = "/tmp/" + name + "-" + label + "-" + process.pid + "-" + (launched += 1);
    rmSync(profile, { recursive: true, force: true });
    const flags = ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + profile, "--remote-debugging-port=" + port, "--remote-allow-origins=*"];
    if (finePointer) flags.push(FINE_POINTER_FLAGS);
    if (windowSize !== undefined) flags.push("--window-size=" + windowSize.width + "," + windowSize.height);
    flags.push("about:blank");
    const chrome = spawn("/usr/bin/google-chrome", flags, { stdio: "ignore", detached: true });
    let wsUrl = null;
    for (let i = 0; i < 80 && !wsUrl; i += 1) {
      try {
        const res = await fetch("http://127.0.0.1:" + port + "/json/version");
        if (res.ok) wsUrl = (await res.json()).webSocketDebuggerUrl;
      } catch {}
      if (!wsUrl) await delay(250);
    }
    if (wsUrl === null) throw new Error(label + ": chrome never exposed a debug endpoint");
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });
    let id = 0;
    const pending = new Map();
    const errors = [];
    const postings = [];
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message);
        pending.delete(message.id);
      } else if (message.method === "Runtime.exceptionThrown") {
        errors.push(message.params.exceptionDetails.text);
      } else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
      } else if (hooks.has(message.method)) {
        for (const handler of hooks.get(message.method)) handler(message.params);
      } else if (message.method === "Network.requestWillBeSent") {
        const request = message.params.request;
        const body = typeof request.postData === "string" ? request.postData : null;
        if (body !== null && request.method === "POST" && request.url.includes("/api/rooms/")) postings.push({ url: request.url, body });
      }
    };
    const send = (method, params = {}, sessionId) =>
      new Promise((resolve) => {
        const at = ++id;
        pending.set(at, resolve);
        ws.send(JSON.stringify({ id: at, method, params, sessionId }));
      });
    const target = (await send("Target.createTarget", { url: "about:blank" })).result;
    const session = (await send("Target.attachToTarget", { targetId: target.targetId, flatten: true })).result.sessionId;
    await send("Page.enable", {}, session);
    await send("Runtime.enable", {}, session);
    await send("Network.enable", {}, session);
    if (viewport !== undefined) await send("Emulation.setDeviceMetricsOverride", { ...viewport, mobile: false }, session);

    const page = {
      errors,
      errorsFor: () => errors.splice(0, errors.length),
      async eval(expression) {
        const message = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, session);
        if (message.result.exceptionDetails) {
          const details = message.result.exceptionDetails;
          throw new Error((details.exception && details.exception.description) || details.text);
        }
        return message.result.result.value;
      },
      evalFn: (fn) => page.eval("(" + fn.toString() + ")()"),
      async goto(url, waitMs = 2600) {
        await send("Page.navigate", { url }, session);
        await delay(waitMs);
      },
      setCookie: (user) => send("Network.setCookie", { url: base, name: user.cookieName, value: user.cookieValue }, session),
      async waitFor(expression, timeoutMs = 10000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          if (await page.eval("!!(" + expression + ")")) return true;
          await delay(200);
        }
        return false;
      },
      hydrated: () => page.waitFor("document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__", 60000),
      rectOf: (jsEl) =>
        page.eval("(() => { const el = " + jsEl + "; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!el.disabled }; })()"),
      async clickReal(jsEl, attempts = 8, settleMs = 400) {
        for (let i = 0; i < attempts; i += 1) {
          const box = await page.rectOf(jsEl);
          if (box === null || box.disabled) {
            await delay(250);
            continue;
          }
          await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y, buttons: 0 }, session);
          await send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", buttons: 1, clickCount: 1 }, session);
          await delay(40);
          await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", buttons: 0, clickCount: 1 }, session);
          await delay(settleMs);
          return true;
        }
        return false;
      },
      async hover(selector, settleMs = 320) {
        const box = await page.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (el === null) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()");
        if (box === null) return false;
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y, buttons: 0 }, session);
        await delay(settleMs);
        return true;
      },
      async unhover() {
        await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2, buttons: 0 }, session);
        await delay(260);
      },
      async media(features) {
        await send("Emulation.setEmulatedMedia", { media: "screen", features }, session);
        await delay(150);
      },
      async metrics(to) {
        await send("Emulation.setDeviceMetricsOverride", { ...to, mobile: to.mobile ?? false }, session);
      },
      async press(key, code, keyCode) {
        await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, session);
        await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, session);
      },
      async shot(name, options = {}) {
        const png = await send("Page.captureScreenshot", { format: "png", fromSurface: true, ...(options.full === true ? { captureBeyondViewport: true } : {}), ...(options.clip === undefined ? {} : { clip: options.clip }) }, session);
        const path = out + "/" + name + ".png";
        writeFileSync(path, Buffer.from(png.result.data, "base64"));
        return path;
      },
      async close() {
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
    return { page, send, session, errors, postings, on, close: page.close };
  };

  const signUp = async (label) => {
    const email = name + "-" + label + "-" + stamp + "@example.com";
    const res = await fetch(base + "/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: base },
      body: JSON.stringify({ email, password: PASSWORD, name: label }),
    });
    const body = await res.text();
    if (res.status !== 200) throw new Error("sign-up " + label + " returned " + res.status + ": " + body.slice(0, 200));
    const pair = res.headers.get("set-cookie").split(";")[0];
    const at = pair.indexOf("=");
    return { label, email, cookie: pair, cookieName: pair.slice(0, at), cookieValue: pair.slice(at + 1) };
  };

  const expect = async (response, what) => {
    if (!response.ok) throw new Error(what + " returned " + response.status + ": " + (await response.text()).slice(0, 200));
    return response;
  };

  const createRoom = async (host, { room, seats = 2, cast = CAST }) => {
    const res = await expect(
      await fetch(base + "/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json", origin: base, cookie: host.cookie },
        body: JSON.stringify({ name: room, seats, setup: { game: "citadels", cast } }),
      }),
      "create room",
    );
    return (await res.json()).room.code;
  };

  const joinRoom = async (code, guest) => {
    await expect(await fetch(base + "/api/rooms/" + code + "/join", { method: "POST", headers: { origin: base, cookie: guest.cookie } }), "join");
  };

  const startRoom = async (code, host) => {
    await expect(await fetch(base + "/api/rooms/" + code + "/start", { method: "POST", headers: { origin: base, cookie: host.cookie } }), "start");
  };

  const openRoom = async ({ room, cast = CAST, hostLabel = "host", guestLabel = "guest" }) => {
    const host = await signUp(hostLabel);
    const guest = await signUp(guestLabel);
    const code = await createRoom(host, { room, cast });
    await joinRoom(code, guest);
    await startRoom(code, host);
    return { code, host, guest };
  };

  const answersAt = () => serverAnswers(base);

  const expectMode = (mode, ...expected) => {
    const ran = checks - answered;
    answered = checks;
    const matches = expectChecks(ran, mode, ...expected);
    if (!matches) failures.push("the " + mode + " mode's check count");
    return matches;
  };

  return { check, info, failures, launch, expectChecks: expectMode, signUp, createRoom, joinRoom, startRoom, openRoom, serverAnswers: answersAt };
};
