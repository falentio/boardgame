// Opens the recordings gallery from disk in headless Chrome and reports what it
// draws: how many cards, and how many of the videos actually decode. A gallery of
// unplayable files would look fine in a listing, which is the point of the check.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const page_url = "file://" + resolve(process.argv[2] ?? ".audit/purpose-webm/index.html");
const shot_path = resolve(process.argv[3] ?? ".audit/purpose-webm/gallery.png");
const port = await new Promise((done) => {
  const probe = createServer();
  probe.listen(0, "127.0.0.1", () => {
    const { port: free } = probe.address();
    probe.close(() => done(free));
  });
});
const profile = mkdtempSync(join(tmpdir(), "purpose-gallery-"));
const chrome = spawn("/usr/bin/google-chrome", [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  "--allow-file-access-from-files", "--autoplay-policy=no-user-gesture-required",
  "--window-size=1600,1200", "--user-data-dir=" + profile,
  "--remote-debugging-port=" + port, "--remote-allow-origins=*",
], { stdio: "ignore", detached: true });

let ws_url = null;
for (let i = 0; i < 40 && ws_url === null; i += 1) {
  try {
    const answer = await fetch("http://127.0.0.1:" + port + "/json/version");
    ws_url = (await answer.json()).webSocketDebuggerUrl ?? null;
  } catch { await delay(250); }
}
if (ws_url === null) throw new Error("chrome never exposed a debug endpoint");

const ws = new WebSocket(ws_url);
await new Promise((done, fail) => { ws.onopen = done; ws.onerror = fail; });
let next = 1;
const pending = new Map();
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  const slot = pending.get(message.id);
  if (slot === undefined) return;
  pending.delete(message.id);
  slot(message);
};
const send = (method, params, session) =>
  new Promise((done) => {
    const id = next;
    next += 1;
    pending.set(id, done);
    const message = { id, method, params };
    if (session !== undefined) message.sessionId = session;
    ws.send(JSON.stringify(message));
  });

const target = await send("Target.createTarget", { url: "about:blank" });
const attached = await send("Target.attachToTarget", { targetId: target.result.targetId, flatten: true });
const session = attached.result.sessionId;
const call = (method, params) => send(method, params, session);
await call("Page.enable", {});
await call("Page.navigate", { url: page_url });
await delay(2500);

const probe = `(() => {
  const videos = [...document.querySelectorAll("video")];
  const decoded = videos.filter((v) => v.videoWidth > 0);
  return {
    headline: document.querySelector("h1") ? document.querySelector("h1").innerText : "",
    figures: document.querySelectorAll("figure").length,
    gaps: document.querySelectorAll("figure.gap").length,
    videos: videos.length,
    decoded: decoded.length,
    sizes: [...new Set(decoded.map((v) => v.videoWidth + "x" + v.videoHeight))],
    seconds: decoded.map((v) => Math.round(v.duration * 10) / 10).slice(0, 3),
  };
})()`;
const read = await call("Runtime.evaluate", { expression: probe, returnByValue: true });
if (read.result === undefined || read.result.result === undefined) {
  console.log("raw evaluate answer:", JSON.stringify(read).slice(0, 600));
  throw new Error("the page did not answer the probe");
}
const found = read.result.result.value;
console.log(JSON.stringify(found, null, 2));

const size = await call("Page.getLayoutMetrics", {});
const height = Math.min(Math.round(size.result.cssContentSize.height), 20000);
const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: 1600, height, scale: 1 } });
writeFileSync(shot_path, Buffer.from(shot.result.data, "base64"));
console.log("screenshot:", shot_path, "page height:", height);
if (found.decoded !== found.videos || found.gaps !== 1) {
  console.log("FAIL expected every video to decode and exactly one gap card");
  process.exitCode = 1;
} else {
  console.log("each of the " + found.videos + " recordings decodes at " + found.sizes.join(", ") + " with 1 gap card");
}
ws.close();
try { process.kill(-chrome.pid); } catch { chrome.kill("SIGKILL"); }
