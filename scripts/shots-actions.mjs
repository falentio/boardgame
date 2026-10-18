import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
const port = 9512; const profile = "/tmp/actions-" + Date.now();
mkdirSync(".audit/actions", { recursive: true });
const chrome = spawn("/usr/bin/google-chrome", ["--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--user-data-dir=" + profile,"--remote-debugging-port=" + port,"--remote-allow-origins=*","about:blank"], { stdio: "ignore", detached: true });
let wsUrl = null;
for (let i = 0; i < 80 && !wsUrl; i++) { try { const r = await fetch("http://127.0.0.1:" + port + "/json/version"); if (r.ok) wsUrl = (await r.json()).webSocketDebuggerUrl; } catch {} if (!wsUrl) await delay(250); }
const ws = new WebSocket(wsUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map(); const errors = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text); else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map(a => a.value ?? a.description).join(" ")); };
const send = (m, p = {}, s) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId: s })); });
const t = (await send("Target.createTarget", { url: "about:blank" })).result;
const s = (await send("Target.attachToTarget", { targetId: t.targetId, flatten: true })).result.sessionId;
await send("Page.enable", {}, s); await send("Runtime.enable", {}, s);
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false }, s);
await send("Page.navigate", { url: "http://localhost:3000/dev/actions-demo" }, s);
await delay(2600);

const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, s)).result.result.value;
const check = (ok, label, detail) => console.log((ok ? "PASS " : "FAIL ") + label + (detail === undefined ? "" : " :: " + JSON.stringify(detail)));

const shape = await evaluate(`(() => {
  const buttons = (root) => [...root.querySelectorAll('[data-slot=citadels-action]')];
  const at = (root) => buttons(root).map((b) => ({ action: b.getAttribute('data-action'), tag: b.tagName, disabled: b.disabled }));
  const section = (name) => document.querySelector('[data-demo=' + name + ']');
  return {
    twoCards: at(section('two-cards')),
    noCards: at(section('no-cards')),
    otherWindow: section('other-window').querySelector('[data-slot=citadels-actions]') !== null,
    rivalWindow: section('rival-window').querySelector('[data-slot=citadels-actions]') !== null,
    noWindow: section('no-window').querySelector('[data-slot=citadels-actions]') !== null,
  };
})()`);
console.log("shape:", JSON.stringify(shape));
check(JSON.stringify(shape.twoCards.map((b) => b.action)) === JSON.stringify(["gold", "draw", "build", "pass"]), "four controls in order (gold, draw, build, pass)", shape.twoCards.map((b) => b.action));
check(shape.twoCards.every((b) => b.tag === "BUTTON"), "each control is a real <button>", shape.twoCards.map((b) => b.tag));
check(shape.twoCards.every((b) => b.disabled === false), "two-card hand: all four enabled", shape.twoCards);
check(JSON.stringify(shape.noCards.map((b) => b.action)) === JSON.stringify(["gold", "draw", "build", "pass"]), "empty hand still renders all four", shape.noCards.map((b) => b.action));
check(JSON.stringify(shape.noCards.filter((b) => b.disabled).map((b) => b.action)) === JSON.stringify(["build"]), "empty hand: only build disabled", shape.noCards.filter((b) => b.disabled).map((b) => b.action));
check(shape.otherWindow === false, "keep window renders nothing", shape.otherWindow);
check(shape.rivalWindow === false, "turn window owed by a rival renders nothing", shape.rivalWindow);
check(shape.noWindow === false, "no window renders nothing", shape.noWindow);

const shot1 = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, s);
writeFileSync(".audit/actions/turn-window.png", Buffer.from(shot1.result.data, "base64"));

const clickResults = await evaluate(`(async () => {
  const out = [];
  for (const action of ['gold', 'draw', 'build', 'pass']) {
    const b = document.querySelector('[data-demo=two-cards] [data-action=' + action + ']');
    b.click();
    await new Promise((r) => setTimeout(r, 60));
    out.push({ action, emitted: JSON.parse(JSON.stringify((window.__emitted || []).slice(-1)[0] ?? null)) });
  }
  const build = document.querySelector('[data-demo=no-cards] [data-action=build]');
  build.click();
  await new Promise((r) => setTimeout(r, 60));
  const after = (window.__emitted || []).length;
  return { clicks: out, all: window.__emitted || [], afterDisabledBuildClick: after };
})()`);
console.log("clicks:", JSON.stringify(clickResults.clicks));
check(JSON.stringify(clickResults.clicks.map((c) => c.action)) === JSON.stringify(["gold", "draw", "build", "pass"]), "clicked all four controls", clickResults.clicks.map((c) => c.action));
check(JSON.stringify(clickResults.clicks.map((c) => c.emitted)) === JSON.stringify([{ t: "gold" }, { t: "draw" }, { t: "build", card: 0 }, { t: "pass" }]), "each click emitted its domain action", clickResults.clicks.map((c) => c.emitted));
check(clickResults.afterDisabledBuildClick === 4, "disabled build in an empty hand emits nothing", clickResults.afterDisabledBuildClick);

const a11y = await evaluate(`(() => {
  const b = document.querySelector('[data-demo=no-cards] [data-action=build]');
  return { title: b.getAttribute('title'), text: b.textContent.trim(), list: document.querySelector('[data-demo=two-cards] [data-slot=citadels-actions]').getAttribute('aria-label') };
})()`);
console.log("a11y:", JSON.stringify(a11y));

const shot2 = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, s);
writeFileSync(".audit/actions/after-clicks.png", Buffer.from(shot2.result.data, "base64"));

const row = await evaluate(`(() => {
  const r = document.querySelector('[data-demo=two-cards] [data-slot=citadels-actions]').getBoundingClientRect();
  const cards = [...document.querySelectorAll('[data-demo=two-cards] [data-action]')].map((b) => { const b2 = b.getBoundingClientRect(); return { action: b.getAttribute('data-action'), x: Math.round(b2.x), y: Math.round(b2.y), w: Math.round(b2.width), h: Math.round(b2.height) }; });
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cards };
})()`);
console.log("layout:", JSON.stringify(row));
check(row.rows === undefined && row.cards.every((c) => c.h > 0 && c.w > 0), "every control has a non-zero box", row.cards);
check(row.cards.every((c) => c.y === row.cards[0].y), "the four controls sit on one row", row.cards.map((c) => c.y));

try { ws.close(); } catch {}
try { process.kill(-chrome.pid); } catch {}
try { rmSync(profile, { recursive: true, force: true }); } catch {}
console.log("console errors:", errors.length ? errors.slice(0,3) : "none");
