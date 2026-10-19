// Records one window purpose as an HD WebM. The scene folds a real engine board,
// the shipped CitadelsBoard draws the window it opens, and Chrome screencasts the
// page while the recording plays the window's entrance and a hover.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { argOf, checkedArgs, createShots, originOf, serverAnswers } from "./lib/shots-harness.mjs";

const args = checkedArgs(process.argv.slice(2), ["--purpose", "--port", "--out"]);
const BASE = originOf(args, { defaultPort: 3000 });
const purpose = argOf(args, "--purpose", null);
const OUT = resolve(argOf(args, "--out", ".audit/purpose-webm"));
if (purpose === null) throw new Error("--purpose <purpose> is required");
if (!(await serverAnswers(BASE))) {
  throw new Error("the dev server on " + BASE + " is not answering; start it before this script");
}

const frames = OUT + "/frames-" + purpose;
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });

const shots = createShots({
  name: "record-" + purpose,
  base: BASE,
  out: OUT,
  viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
  detail: "json",
});
const { page, send, session, on, close } = await shots.launch({ label: purpose, windowSize: { width: 1920, height: 1080 } });

const captured = [];
on("Page.screencastFrame", (params) => {
  const file = frames + "/" + String(captured.length).padStart(5, "0") + ".jpg";
  writeFileSync(file, Buffer.from(params.data, "base64"));
  captured.push({ file, at: Date.now() });
  void send("Page.screencastFrameAck", { sessionId: params.sessionId }, session);
});

await send(
  "Page.startScreencast",
  { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 },
  session,
);

await page.goto(BASE + "/dev/citadels-interface?p=" + purpose, 900);
let ready = false;
for (let i = 0; i < 60 && !ready; i += 1) {
  ready = (await page.eval("window.__purposeReady === true")) === true;
  if (!ready) await delay(500);
}
const read = await page.eval(
  "(() => ({ purpose: document.querySelector('[data-slot=purpose-label]')?.innerText ?? null, board: document.querySelector('[data-slot=citadels-board]') !== null, window: document.querySelector('[data-slot=citadels-choice-option], [data-slot=citadels-backdrop], [data-slot=citadels-hand]') !== null }))()",
);

const geometry = await page.eval(`(() => {
  const r = (sel) => {
    const el = document.querySelector(sel);
    if (el === null) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) };
  };
  return {
    board: r('[data-slot=citadels-board]'),
    window: r('[data-slot=citadels-choice], [data-slot=citadels-pick], [data-slot=citadels-keep]'),
    optionCount: document.querySelectorAll('[data-slot=citadels-choice-option]').length,
    firstOption: r('[data-slot=citadels-choice-option]'),
    viewport: [window.innerWidth, window.innerHeight],
    fitsViewport: document.documentElement.scrollHeight <= window.innerHeight + 1,
    fitsWide: document.documentElement.scrollWidth <= window.innerWidth + 1,
  };
})()`);

const firstTarget =
  "[data-slot=citadels-choice-option], [data-slot=citadels-hand-tile], [data-slot=citadels-character-card], [data-slot=citadels-action], [data-slot=citadels-cast-row]";
// The page falls back to its own demo board when a fold throws, so a drawn board
// proves nothing. The label carries the frame count only when THIS purpose folded,
// and the surface says so in words when the engine reached no such window.
if (read.board !== true || !/FOLDED IN [0-9]+ FRAMES/.test(String(read.purpose ?? "").toUpperCase())) {
  const said = await page.eval(
    "(document.querySelector('[data-slot=citadels-surface]') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 240)",
  );
  throw new Error("the page did not fold " + purpose + ": " + String(said));
}
await page.hover(firstTarget, 1200);
await page.unhover();
await page.hover(
  "[data-slot=citadels-choice-option]:last-of-type, [data-slot=citadels-cast-row]:last-of-type, [data-slot=citadels-action]:last-of-type",
  1000,
);
await page.unhover();
await delay(600);
await send("Page.stopScreencast", {}, session);
close();

if (captured.length < 8) {
  throw new Error("only " + String(captured.length) + " frames captured for " + purpose);
}
const concat = frames + "/concat.txt";
const lines = [];
for (let i = 0; i < captured.length; i += 1) {
  lines.push("file '" + captured[i].file + "'");
  if (i > 0) {
    const dt = (captured[i].at - captured[i - 1].at) / 1000;
    lines.push("duration " + Math.min(0.5, Math.max(1 / 60, dt)).toFixed(4));
  }
}
lines.push("file '" + captured[captured.length - 1].file + "'");
writeFileSync(concat, lines.join("\n") + "\n");

const webm = OUT + "/" + purpose + ".webm";
const encode = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", concat,
    "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
    "-c:v", "libvpx-vp9",
    "-crf", "34",
    "-b:v", "0",
    "-pix_fmt", "yuv420p",
    "-row-mt", "1",
    webm,
  ],
  { encoding: "utf8" },
);
if (encode.status !== 0) {
  const tail = String(encode.stderr).trim().split("\n").slice(-3).join(" | ");
  throw new Error("ffmpeg exited " + String(encode.status) + ": " + tail);
}

const probe = spawnSync(
  "ffprobe",
  ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate,nb_frames", "-show_entries", "format=duration,size", "-of", "json", webm],
  { encoding: "utf8" },
);
const meta = JSON.parse(probe.stdout);
const stream = meta.streams[0];
const seconds = Number(meta.format.duration).toFixed(2);
console.log(
  "RECORDED " + purpose + " :: " + JSON.stringify({ webm, width: stream.width, height: stream.height, seconds, bytes: Number(meta.format.size), frames: captured.length, onPage: read, geometry }),
);
rmSync(frames, { recursive: true, force: true });
