import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const port = 9512;
const profile = "/tmp/keep-" + Date.now();
mkdirSync(".audit/keep", { recursive: true });
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

const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, s);
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text + " " + JSON.stringify(r.result.exceptionDetails.exception?.description));
  return r.result.result.value;
};
const shot = async (name) => {
  const png = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, s);
  writeFileSync(".audit/keep/" + name, Buffer.from(png.result.data, "base64"));
};
let failures = 0;
const check = (ok, label, detail) => { if (!ok) failures += 1; console.log((ok ? "PASS " : "FAIL ") + label + (detail === undefined ? "" : " :: " + detail)); };

await send("Page.navigate", { url: "http://localhost:3000/dev/keep-demo" }, s);
await delay(2600);

const window0 = await evaluate("(() => { const keep = document.querySelector('[data-slot=citadels-keep]'); if (!keep) return null; const cards = [...keep.querySelectorAll('[data-slot=citadels-keep-card]')]; const r = keep.getBoundingClientRect(); const parent = keep.parentElement.getBoundingClientRect(); const style = getComputedStyle(keep); const names = [...keep.querySelectorAll('[data-slot=citadels-district] .citadels-district-name')]; return { cards: cards.length, index: cards.map(c => c.getAttribute('data-index')), district: cards.map(c => c.getAttribute('data-district')), inset: Math.round(r.left - parent.left) + ',' + Math.round(r.top - parent.top), size: Math.round(r.width) + 'x' + Math.round(r.height), parent: Math.round(parent.width) + 'x' + Math.round(parent.height), background: style.backgroundColor, blur: style.backdropFilter, opaque: style.backgroundColor.includes(', 1)'), names: names.map(n => ({ text: n.textContent.trim(), wrap: getComputedStyle(n).overflowWrap, scrolls: n.scrollWidth > n.clientWidth + 1 })) }; })()");
check(window0 !== null, "section exists in keep window");
console.log("keep:", JSON.stringify(window0));
check(window0?.cards === 2, "exactly two keep cards", String(window0?.cards));
check(JSON.stringify(window0?.index) === JSON.stringify(["0", "1"]), "data-index are the pool indexes the reducer reads", JSON.stringify(window0?.index));
check(window0?.district.join() === "haunted-quarter,school-of-magic", "drawn pair is the pending pool", String(window0?.district));
check(window0?.inset === "0,0" && window0?.size === window0?.parent, "covers the self column", window0?.inset + " " + window0?.size);
check(/\/ 0\.3\)$/.test(window0?.background ?? ""), "30% monokai tint", String(window0?.background));
check(window0?.blur === "blur(2px)", "2px backdrop blur", String(window0?.blur));
check((window0?.names ?? []).every(n => n.wrap === "anywhere" && !n.scrolls), "card names wrap and never truncate", JSON.stringify(window0?.names));
await shot("keep-window.png");

await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }, s);
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 }, s);
await delay(400);
const afterEscape = await evaluate("(() => ({ section: !!document.querySelector('[data-slot=citadels-keep]'), log: document.querySelector('[data-slot=keep-demo-log]')?.textContent.trim() }))()");
check(afterEscape.section && afterEscape.log === "keep none", "escape leaves the window untouched", JSON.stringify(afterEscape));
await shot("keep-after-escape.png");

const clicked = await evaluate("(() => { const card = document.querySelector('[data-index=\"1\"]'); if (!card) return 'none'; card.click(); return card.getAttribute('data-district'); })()");
await delay(400);
const afterClick = await evaluate("(() => ({ section: !!document.querySelector('[data-slot=citadels-keep]'), log: document.querySelector('[data-slot=keep-demo-log]')?.textContent.trim() }))()");
console.log("clicked:", clicked);
check(afterClick.log === "keep 1", "clicking the second card reports keep index 1", JSON.stringify(afterClick));
await shot("keep-after-click.png");

try { ws.close(); } catch {}
try { process.kill(-chrome.pid); } catch {}
try { rmSync(profile, { recursive: true, force: true }); } catch {}
console.log("console errors:", errors.length ? errors.slice(0, 3) : "none");
console.log(failures === 0 ? "ALL CHECKS PASS" : failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
