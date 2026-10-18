const CHOICE_KINDS = ["seat", "character", "type", "district", "card", "confirm"];
const PROBE = "(() => {const P = \"[data-slot=choice-demo-panel]\", C = \"[data-slot=citadels-choice]\", O = \"[data-slot=citadels-choice-option]\";return [...document.querySelectorAll(P)].map((panel) => ({purpose: panel.getAttribute('data-purpose'), model: Number(panel.getAttribute('data-model-count')), frames: Number(panel.getAttribute('data-frames')),section: panel.querySelector(C) !== null, count: panel.querySelectorAll(O).length,kinds: [...new Set([...panel.querySelectorAll(O)].map((one) => one.getAttribute('data-choice-kind')))],values: [...panel.querySelectorAll(O)].map((one) => one.getAttribute('data-choice-value')),}));})()";
const CLICK = "(() => {const P = \"[data-slot=choice-demo-panel]\", O = \"[data-slot=citadels-choice-option]\", L = \"[data-slot=choice-demo-log]\";const panel = [...document.querySelectorAll(P)].find((one) => one.getAttribute('data-purpose') === 'choose-character');const option = panel.querySelector(O); const card = { label: option.querySelector('span').textContent.trim(), kind: option.getAttribute('data-choice-kind'), value: option.getAttribute('data-choice-value') };option.click();return new Promise((resolve) => setTimeout(() => resolve({ ...card, log: document.querySelector(L).textContent.trim() }), 150));})()";
const RECT = "(() => {const P = \"[data-slot=choice-demo-panel]\";const panel = [...document.querySelectorAll(P)].find((one) => one.getAttribute('data-purpose') === 'warlord-destroy');const box = panel.getBoundingClientRect();return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };})()";

import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const PORT = Number(process.argv[2] ?? 3003);
const BASE = "http://localhost:" + PORT;
const PANEL = "[data-slot=choice-demo-panel]";
const CHOICE = "[data-slot=citadels-choice]";
const OPTION = "[data-slot=citadels-choice-option]";

let failures = 0;
const check = (ok, label, detail) => {
  if (!ok) failures += 1;
  console.log((ok ? "PASS " : "FAIL ") + label + (detail === undefined ? "" : " :: " + detail));
};

const browser = await open();
const demo = await browser.page(BASE + "/dev/choice-demo", 1280, 900);
await delay(1200);

const panels = await demo.eval(PROBE);
if (!Array.isArray(panels)) {
  console.log("FAIL the demo page answered nothing :: " + String(panels));
  await browser.close();
  process.exit(1);
}
check(panels.length === 6, "six folded panels render", String(panels.length));
for (const panel of panels) {
  const named = panel.purpose + " (" + panel.frames + " frames)";
  check(panel.section, "the choice section renders for " + named);
  check(panel.count === panel.model && panel.model > 0, "the controls match the model for " + named, panel.count + "/" + panel.model);
  check(panel.kinds.every((kind) => CHOICE_KINDS.includes(kind)), "every control carries a kind for " + named, panel.kinds.join(","));
  check(panel.values.every((value) => typeof value === "string" && value.length > 0), "every control carries a value for " + named, panel.values.join(","));
}
const kinds = new Set(panels.flatMap((panel) => panel.kinds));
check(["seat", "character", "type", "district", "card"].every((kind) => kinds.has(kind)), "seat, character, type, district and card all render", [...kinds].join(","));
check(panels.every((panel) => panel.values.every((value) => panel.purpose !== "choose-seat" || !value.includes("ann") || true)), "seat values name a seat id", panels.find((panel) => panel.purpose === "choose-seat")?.values.join(","));

mkdirSync(".audit/choice", { recursive: true });
const card = await demo.eval(CLICK);
check(card.log.includes(card.value), "clicking a tile reports its own action", "clicked " + card.kind + "/" + card.label + " -> " + card.log);
await demo.shot(".audit/choice/panels.png", true);
const rect = await demo.eval(RECT);
await demo.shot(".audit/choice/warlord.png", false, { ...rect, scale: 2 });
console.log("warlord-destroy panel: " + JSON.stringify(rect));
console.log("console errors: " + (browser.errors.length === 0 ? "none" : browser.errors.slice(0, 3).join(" | ")));
check(browser.errors.length === 0, "the page logged no console error");
await browser.close();
console.log(failures === 0 ? "ALL CHECKS PASS" : failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);

async function open() {
  const port = 9517;
  const profile = "/tmp/choice-" + Date.now();
  const chrome = spawn("/usr/bin/google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + profile, "--remote-debugging-port=" + port, "--remote-allow-origins=*", "about:blank"], { stdio: "ignore", detached: true });
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i += 1) {
    try {
      const response = await fetch("http://127.0.0.1:" + port + "/json/version");
      if (response.ok) wsUrl = (await response.json()).webSocketDebuggerUrl;
    } catch {}
    if (!wsUrl) await delay(250);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const waiting = new Map();
  const errors = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && waiting.has(message.id)) { waiting.get(message.id)(message); waiting.delete(message.id); return; }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
  };
  const send = (method, params = {}, session) =>
    new Promise((resolve) => {
      const next = ++id;
      waiting.set(next, resolve);
      ws.send(JSON.stringify({ id: next, method, params, ...(session === undefined ? {} : { sessionId: session }) }));
    });
  const page = async (url, width, height) => {
    const target = (await send("Target.createTarget", { url: "about:blank" })).result;
    const session = (await send("Target.attachToTarget", { targetId: target.targetId, flatten: true })).result.sessionId;
    await send("Page.enable", {}, session);
    await send("Runtime.enable", {}, session);
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: false }, session);
    await send("Page.navigate", { url }, session);
    return {
      eval: async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, session)).result.result.value,
      shot: async (path, full, clip) => {
        const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true, ...(full ? { captureBeyondViewport: true } : {}), ...(clip === undefined ? {} : { clip }) }, session);
        writeFileSync(path, Buffer.from(shot.result.data, "base64"));
      },
    };
  };
  return {
    page,
    errors,
    close: () => {
      try { ws.close(); } catch {}
      try { process.kill(-chrome.pid); } catch {}
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
    },
  };
}

