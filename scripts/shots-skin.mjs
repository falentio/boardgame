import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const port = 9531;
const profile = "/tmp/skin-" + Date.now();
const OUT = ".audit/skin";
const LIVE = process.argv.includes("--live");
const ORIGIN = "http://localhost:3000";
const PASSWORD = "proof-password-123";
const CAST = ["assassin", "thief", "magician", "king", "bishop", "merchant", "architect", "warlord"];
let BOARD_URL = process.argv[2] ?? ORIGIN + "/dev/citadels-interface";
let PICKER_URL = process.argv[3] ?? ORIGIN + "/dev/picker-demo";
const TAG = LIVE ? "live" : (process.argv[4] ?? "after");
mkdirSync(OUT, { recursive: true });

const chrome = spawn("/usr/bin/google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + profile, "--remote-debugging-port=" + port, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore", detached: true });
let wsUrl = null;
for (let i = 0; i < 80 && !wsUrl; i++) { try { const r = await fetch("http://127.0.0.1:" + port + "/json/version"); if (r.ok) wsUrl = (await r.json()).webSocketDebuggerUrl; } catch {} if (!wsUrl) await delay(250); }
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text); else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ")); };
const send = (m, p = {}, s) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s })); });
const t = (await send("Target.createTarget", { url: "about:blank" })).result;
const s = (await send("Target.attachToTarget", { targetId: t.targetId, flatten: true })).result.sessionId;
await send("Page.enable", {}, s);
await send("Runtime.enable", {}, s);
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false }, s);
const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, s)).result.result.value;
const shot = async (name) => {
  const r = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, s);
  writeFileSync(OUT + "/" + name + "-" + TAG + ".png", Buffer.from(r.result.data, "base64"));
};

const signUp = async (label) => {
  const email = "skin-" + label + "-" + Date.now() + "@example.com";
  const res = await fetch(ORIGIN + "/api/auth/sign-up/email", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ email, password: PASSWORD, name: label }) });
  if (res.status !== 200) throw new Error("sign-up " + label + " returned " + res.status + ": " + (await res.text()).slice(0, 160));
  const pair = res.headers.get("set-cookie").split(";")[0];
  const at = pair.indexOf("=");
  return { cookie: pair, cookieName: pair.slice(0, at), cookieValue: pair.slice(at + 1) };
};

/** A started two-seat room, so the assertions run inside the live /games/<code> surface. */
const startLiveRoom = async () => {
  const host = await signUp("skinskinhost");
  const guest = await signUp("skinskinguest");
  const created = await fetch(ORIGIN + "/api/rooms", { method: "POST", headers: { origin: ORIGIN, cookie: host.cookie, "content-type": "application/json" }, body: JSON.stringify({ name: "skin board", seats: 2, setup: { game: "citadels", cast: CAST } }) });
  if (created.status !== 201) throw new Error("create room returned " + created.status + ": " + (await created.text()).slice(0, 200));
  const { room } = await created.json();
  const joined = await fetch(ORIGIN + "/api/rooms/" + room.code + "/join", { method: "POST", headers: { origin: ORIGIN, cookie: guest.cookie, "content-type": "application/json" } });
  if (joined.status !== 200) throw new Error("join returned " + joined.status + ": " + (await joined.text()).slice(0, 200));
  const started = await fetch(ORIGIN + "/api/rooms/" + room.code + "/start", { method: "POST", headers: { origin: ORIGIN, cookie: host.cookie, "content-type": "application/json" } });
  if (started.status !== 200) throw new Error("start returned " + started.status + ": " + (await started.text()).slice(0, 200));
  console.log("live room " + room.code + " started with host " + host.cookieName);
  return { code: room.code, host };
};

const fail = [];
const check = (ok, msg) => {
  console.log((ok ? "PASS " : "FAIL ") + msg);
  if (!ok) fail.push(msg);
};
const RULE = "rgb(230, 219, 116)";
const maxOf = (shorthand) => Math.max(...String(shorthand).split(" ").map((v) => parseFloat(v) || 0));

/** A rounded element is only ours when its own markup lives in one of this unit's files. */
const OURS = ["citadels-seat", "citadels-cast-row", "citadels-cast-flag", "citadels-global-plate", "citadels-self-plate", "citadels-back", "citadels-window", "citadels-city", "citadels-district", "citadels-global", "citadels-board", "citadels-players", "citadels-self", "citadels-picker", "citadels-picker-grid", "citadels-picker-card", "citadels-picker-dialog", "citadels-picker-confirm", "citadels-picker-cancel"];
const radiusProbe = (selector) => `(() => {
  const root = document.querySelector("${selector}");
  if (root === null) return { total: 0, hits: [{ tag: "root", file: "this-unit", radius: "missing" }] };
  const ours = ${JSON.stringify(OURS)};
  const all = [root, ...root.querySelectorAll("*")];
  const hits = [];
  let total = 0;
  for (const el of all) {
    if (el instanceof HTMLImageElement && el.src.includes("dicebear.com")) continue;
    total += 1;
    const radius = getComputedStyle(el).borderTopLeftRadius;
    if (parseFloat(radius) > 0) {
      hits.push({
        tag: el.tagName.toLowerCase(),
        slot: el.getAttribute("data-slot"),
        radius: radius === "3.35544e+07px" ? "pill" : radius,
        file: el.closest("[data-slot=citadels-exit]") !== null ? "CitadelsGameScreen.vue" : el.closest("[data-slot=citadels-hand]") !== null ? "CitadelsHand.vue" : el.closest("[data-slot=citadels-keep]") !== null ? "CitadelsKeep.vue" : el.closest("[data-slot=citadels-picker-card]") !== null ? "CitadelsPick.vue or CitadelsHand.vue" : "this-unit",
      });
    }
  }
  return { total, hits };
})()`;

let liveCode = null;
if (LIVE) {
  const live = await startLiveRoom();
  liveCode = live.code;
  await send("Network.enable", {}, s);
  await send("Network.setCookie", { name: live.host.cookieName, value: live.host.cookieValue, domain: "localhost", path: "/" }, s);
  BOARD_URL = ORIGIN + "/games/" + live.code;
}
await send("Page.navigate", { url: BOARD_URL }, s);
await delay(3000);
if (LIVE) {
  const enter = await ev(`(() => {
    const el = document.querySelector("[data-slot=citadels-enter]");
    if (el === null) return null;
    const box = el.getBoundingClientRect();
    return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
  })()`);
  if (enter === null) throw new Error("the live /games route drew no [data-slot=citadels-enter] control");
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: enter.x, y: enter.y, button: "left", buttons: 1, clickCount: 1 }, s);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: enter.x, y: enter.y, button: "left", buttons: 0, clickCount: 1 }, s);
  for (let i = 0; i < 40; i++) {
    if (await ev("document.querySelector('[data-slot=citadels-surface]') !== null")) break;
    await delay(500);
  }
  const up = await ev("document.querySelector('[data-slot=citadels-surface]') !== null");
  check(up, "the live /games/" + liveCode + " route opened [data-slot=citadels-surface]");
  if (!up) console.log("   page says: " + (await ev("document.body.innerText.replace(/\\n+/g, ' | ').slice(0, 240)")));
}

const boardRadius = await ev(radiusProbe("[data-slot=citadels-surface]"));
const OWNED = boardRadius.hits.filter((hit) => hit.file === "this-unit");
const FOREIGN = boardRadius.hits.filter((hit) => hit.file !== "this-unit");
check(OWNED.length === 0, "elements this unit owns with computed border-radius above 0px: " + OWNED.length + " of " + boardRadius.total);
if (FOREIGN.length > 0) console.log("   NOT OURS (" + FOREIGN.length + "): " + JSON.stringify(FOREIGN));
check(boardRadius.hits.length === 0, "surface elements with computed border-radius above 0px: " + boardRadius.hits.length + " of " + boardRadius.total);
if (boardRadius.hits.length > 0) console.log("   " + JSON.stringify(boardRadius.hits.slice(0, 12)));

const skin = await ev(`(() => {
  const frameOf = (sel) => {
    const el = document.querySelector(sel);
    if (el === null) return { shadow: "missing" };
    const box = el.getBoundingClientRect();
    return { shadow: getComputedStyle(el).boxShadow, w: Math.round(box.width), h: Math.round(box.height) };
  };
  const styleOf = (sel, prop) => {
    const el = document.querySelector(sel);
    return el === null ? "missing" : getComputedStyle(el)[prop];
  };
  return {
    district: frameOf("[data-slot=citadels-district]"),
    row: frameOf("[data-slot=citadels-cast-row]"),
    plate: frameOf("[data-slot=citadels-global-plate]"),
    surfacePad: styleOf("[data-slot=citadels-surface]", "padding"),
    boardPad: styleOf("[data-slot=citadels-board]", "padding"),
    boardGap: styleOf("[data-slot=citadels-board]", "gap"),
    selfGap: styleOf("[data-slot=citadels-self]", "gap"),
    head: (() => {
      const plate = document.querySelector("[data-slot=citadels-global-plate]");
      if (plate === null) return "missing";
      const ink = (sel) => { const el = plate.querySelector(sel); return el === null ? null : el.textContent.trim(); };
      return { round: ink("[data-slot=citadels-global-round]"), phase: ink("[data-slot=citadels-global-phase]") };
    })(),
    cast: (() => {
      const rows = [...document.querySelectorAll("[data-slot=citadels-cast-row]")];
      const framed = rows.filter((row) => {
        const emblem = row.querySelector("[data-slot=citadels-cast-emblem]");
        const flag = row.querySelector("[data-slot=citadels-cast-flag]");
        if (emblem === null || flag === null) return false;
        const box = row.getBoundingClientRect();
        const inside = emblem.getBoundingClientRect().left - box.left >= 6 && box.right - flag.getBoundingClientRect().right >= 6;
        const cut = getComputedStyle(flag).backgroundColor !== "rgba(0, 0, 0, 0)" && flag.textContent.trim().length > 0;
        return getComputedStyle(row).boxShadow.split("inset").length === 4 && inside && cut;
      });
      const first = rows[0];
      const emblemOf = first === undefined ? null : first.querySelector("[data-slot=citadels-cast-emblem]");
      const flagOf = first === undefined ? null : first.querySelector("[data-slot=citadels-cast-flag]");
      return {
        rows: rows.length,
        framed: framed.length,
        emblemInset: first === undefined || emblemOf === null ? null : Math.round(emblemOf.getBoundingClientRect().left - first.getBoundingClientRect().left),
        flagInset: first === undefined || flagOf === null ? null : Math.round(first.getBoundingClientRect().right - flagOf.getBoundingClientRect().right),
        flag: flagOf === null ? null : flagOf.textContent.trim(),
      };
    })(),
  };
})()`);

console.log("district box-shadow:", skin.district.shadow);
console.log("cast row box-shadow:", skin.row.shadow);
console.log("cast row size:", skin.row.w + "x" + skin.row.h);
console.log("header plate box-shadow:", skin.plate.shadow);
console.log("surface padding:", skin.surfacePad, "| board padding:", skin.boardPad, "| board gap:", skin.boardGap, "| self gap:", skin.selfGap);

check(String(skin.district.shadow).includes("inset"), "district card keeps its inset frame");
check(String(skin.row.shadow).includes("inset") && String(skin.row.shadow).split("inset").length === 4, "cast row carries the three-layer framed inset rule");
check(String(skin.plate.shadow).includes("inset") && String(skin.plate.shadow).includes(RULE), "header reads as a framed plate");
check(skin.head !== "missing" && skin.head.round !== null && skin.head.phase !== null, "round and phase sit as ink on the board plate " + JSON.stringify(skin.head));
console.log("cast row: emblem inset " + skin.cast.emblemInset + "px, state plate inset " + skin.cast.flagInset + "px, state word \"" + skin.cast.flag + "\" cut in its own ink");
check(skin.cast.rows > 0 && skin.cast.framed === skin.cast.rows, "cast rows carry a framed emblem and a cut state plate: " + skin.cast.framed + "/" + skin.cast.rows);
check(maxOf(skin.surfacePad) <= 20, "surface padding at or under 1.25rem (got " + skin.surfacePad + ")");
check(maxOf(skin.boardPad) <= 20, "board padding at or under 1.25rem (got " + skin.boardPad + ")");
check(maxOf(skin.boardGap) <= 4, "board section gap at or under 0.25rem (got " + skin.boardGap + ")");
check(maxOf(skin.selfGap) <= 4, "self column gap at or under 0.25rem (got " + skin.selfGap + ")");

await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false }, s);
await shot("board");

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, s);
await delay(700);
await shot("board-portrait");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false }, s);
await delay(700);

const centerOf = (selector) => ev(`(() => {
  const el = document.querySelector("${selector}");
  if (el === null) return null;
  const box = el.getBoundingClientRect();
  return { x: Math.round(box.left + box.width / 2), y: Math.round(box.top + box.height / 2) };
})()`);
const shadowOf = (selector) => ev(`(() => {
  const el = document.querySelector("${selector}");
  return el === null ? "missing" : { shadow: getComputedStyle(el).boxShadow, translate: getComputedStyle(el).translate, hovered: el.matches(":hover") };
})()`);
const hoverOf = async (selector) => {
  const before = await shadowOf(selector);
  const box = await centerOf(selector);
  if (box === null) return { before, after: "no element" };
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y, button: "none", buttons: 0 }, s);
  await delay(350);
  const after = await shadowOf(selector);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 4, y: 4, button: "none", buttons: 0 }, s);
  return { before, after };
};
/** The draft overlay covers the board, so the topmost in-scope control is the one to probe. */
const covered = await ev("document.querySelector('[data-slot=citadels-picker]') !== null");
const target = covered ? "[data-slot=citadels-picker-card]:not([disabled])" : "[data-slot=citadels-seat]";
const hovered = await hoverOf(target);
console.log("hover " + target + ":", JSON.stringify(hovered));
check(
  typeof hovered.after === "object" && hovered.after.hovered === true && hovered.after.shadow.includes(RULE) && hovered.after.translate === "0px -1px",
  "the topmost control turns its frame to --monokai-yellow and lifts 1px on hover (" + target + ")",
);
if (covered) {
  await ev(`(() => { const c = document.querySelector("[data-slot=citadels-picker-card]:not([disabled])"); if (c !== null) c.click(); })()`);
  await delay(500);
  await ev(`(() => { const c = document.querySelector("[data-slot=citadels-picker-confirm]"); if (c !== null) c.click(); })()`);
  await delay(1600);
  const cleared = await ev("document.querySelector('[data-slot=citadels-picker]') === null");
  console.log("draft overlay cleared after the pick:", cleared);
  if (cleared) {
    const hoverSeat = await hoverOf("[data-slot=citadels-seat]");
    console.log("hover seat:", JSON.stringify(hoverSeat));
    check(
      typeof hoverSeat.after === "object" && hoverSeat.after.hovered === true && hoverSeat.after.shadow.includes(RULE) && hoverSeat.after.translate === "0px -1px",
      "a seat tile turns its frame to --monokai-yellow and lifts 1px on hover",
    );
  }
}

if (!LIVE) {
  await send("Page.navigate", { url: PICKER_URL }, s);
  await delay(2800);

  const pickerRadius = await ev(radiusProbe("[data-slot=citadels-picker]"));
  check(pickerRadius.hits.length === 0, "picker elements with computed border-radius above 0px: " + pickerRadius.hits.length + " of " + pickerRadius.total);
  if (pickerRadius.hits.length > 0) console.log("   " + JSON.stringify(pickerRadius.hits.slice(0, 12)));
  const pickerSkin = await ev(`(() => {
    const root = document.querySelector("[data-slot=citadels-picker]");
    if (root === null) return { pad: "missing", card: "missing", grid: "missing" };
    const card = root.querySelector("[data-slot=citadels-picker-card]");
    return {
      pad: getComputedStyle(root).padding,
      grid: getComputedStyle(root.querySelector("[data-slot=citadels-picker-grid]")).gap,
      card: card === null ? "missing" : getComputedStyle(card).boxShadow,
    };
  })()`);
  console.log("picker padding:", pickerSkin.pad, "| grid gap:", pickerSkin.grid);
  console.log("picker card box-shadow:", pickerSkin.card);
  check(maxOf(pickerSkin.pad) <= 20, "picker padding at or under 1.25rem (got " + pickerSkin.pad + ")");

  await ev(`(() => { const c = document.querySelector("[data-slot=citadels-picker-card]:not([disabled])"); if (c !== null) c.click(); })()`);
  await delay(700);
  await shot("picker");
  const pickerRadius2 = await ev(radiusProbe("[data-slot=citadels-interface], [data-slot=citadels-picker]"));
  check(pickerRadius2.hits.length === 0, "picker with its confirm panel rounded elements: " + pickerRadius2.hits.length + " of " + pickerRadius2.total);
  if (pickerRadius2.hits.length > 0) console.log("   " + JSON.stringify(pickerRadius2.hits.slice(0, 12)));
  await shot("picker-choose");
}


console.log("console errors:", errors.length ? errors.slice(0, 3) : "none");
console.log(fail.length === 0 ? "ALL CHECKS PASS" : fail.length + " CHECK(S) FAILED");
try { ws.close(); } catch {}
try { process.kill(-chrome.pid); } catch {}
try { rmSync(profile, { recursive: true, force: true }); } catch {}
process.exitCode = fail.length === 0 ? 0 : 1;
