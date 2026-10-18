import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
const port = 9511; const profile = "/tmp/pick-" + Date.now();
mkdirSync(".audit/pick", { recursive: true });
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
await send("Page.navigate", { url: "http://localhost:3000/dev/picker-demo" }, s);
await delay(2600);
const probe = await send("Runtime.evaluate", { expression: "(() => { const picker = document.querySelector('[data-slot=citadels-picker]'); if (!picker) return 'no picker'; const cards = [...picker.querySelectorAll('[data-slot=citadels-picker-card]')]; const r = picker.getBoundingClientRect(); const parent = picker.parentElement.getBoundingClientRect(); return JSON.stringify({ cards: cards.length, inset: Math.round(r.left - parent.left) + ',' + Math.round(r.top - parent.top), covers: Math.round(r.width) + 'x' + Math.round(r.height), parent: Math.round(parent.width) + 'x' + Math.round(parent.height), disabled: cards.filter(c => c.disabled).length }); })()", returnByValue: true }, s);
console.log("picker:", probe.result.result.value);
const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, s);
writeFileSync(".audit/pick/picker.png", Buffer.from(shot.result.data, "base64"));
const click = await send("Runtime.evaluate", { expression: "(() => { const c = document.querySelector('[data-slot=citadels-picker-card]:not([disabled])'); if (!c) return 'none'; c.click(); return c.getAttribute('data-character'); })()", returnByValue: true }, s);
console.log("clicked:", click.result.result.value);
await delay(600);
const dialog = await send("Runtime.evaluate", { expression: "(() => { const d = document.querySelector('[data-slot=citadels-picker-dialog]'); if (!d) return 'no dialog'; return JSON.stringify({ role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), ability: d.querySelector('[data-slot=citadels-picker-ability]')?.textContent.trim().slice(0, 70), confirm: d.querySelector('[data-slot=citadels-picker-confirm]')?.textContent.trim(), cancel: !!d.querySelector('[data-slot=citadels-picker-cancel]') }); })()", returnByValue: true }, s);
console.log("dialog:", dialog.result.result.value);
const shot2 = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, s);
writeFileSync(".audit/pick/dialog.png", Buffer.from(shot2.result.data, "base64"));
try { ws.close(); } catch {}
try { process.kill(-chrome.pid); } catch {}
try { rmSync(profile, { recursive: true, force: true }); } catch {}
console.log("console errors:", errors.length ? errors.slice(0,3) : "none");