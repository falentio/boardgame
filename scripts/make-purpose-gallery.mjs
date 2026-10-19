// Builds the manifest and the gallery for the purpose recordings. A declared purpose
// with no recording is drawn as a gap card naming why, so the page never reads as if
// the set were complete when it is not.
import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { census } from "./purpose-census.mjs";

const OUT = resolve(process.argv[2] ?? ".audit/purpose-webm");
const files = readdirSync(OUT).filter((name) => name.endsWith(".webm")).sort();
const rows = [];
for (const name of files) {
  const path = OUT + "/" + name;
  const probe = JSON.parse(
    execFileSync("ffprobe", [
      "-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height,nb_frames",
      "-show_entries", "format=duration,size", "-of", "json", path,
    ], { encoding: "utf8" }),
  );
  const stream = probe.streams[0];
  const purpose = name.slice(0, -"".concat(".webm").length);
  rows.push({
    purpose,
    width: stream.width,
    height: stream.height,
    seconds: Number(Number(probe.format.duration).toFixed(2)),
    bytes: Number(probe.format.size),
    frames: Number(stream.nb_frames ?? 0),
    file: name,
  });
}
const manifest = [
  ["purpose", "width", "height", "seconds", "bytes", "frames", "file"].join("\t"),
  ...rows.map((r) => [r.purpose, r.width, r.height, r.seconds, r.bytes, r.frames, r.file].join("\t")),
].join("\n") + "\n";
writeFileSync(OUT + "/manifest.tsv", manifest);

const recorded = new Set(rows.map((r) => r.purpose));
const gaps = census().filter((row) => !recorded.has(row.purpose));
const cards = rows
  .map(
    (r) =>
      "  <figure>\n    <video src=\"./" + r.file + "\" controls muted loop playsinline preload=\"metadata\"></video>\n    <figcaption><b>" + r.purpose + "</b><span>" + r.width + "x" + r.height + " · " + r.seconds + "s · " + Math.round(r.bytes / 1024) + " KB</span></figcaption>\n  </figure>",
  )
  .join("\n");
const gapCards = gaps
  .map(
    (gap) =>
      "  <figure class=\"gap\">\n    <div class=\"gap-body\"><b>" + gap.purpose + "</b>" +
      "<span>" + (gap.sites.length === 0 ? "no recording · the engine never opens this window" : "no recording yet · opened by " + gap.sites[0]) + "</span>" +
      (gap.sites.length === 0
        ? "<p>The engine declares the purpose, gives it a kind and registers a resolver, but no code builds a window for it, so its resolver cannot run. A scene cannot fold what the engine will not open.</p><code>node scripts/purpose-census.mjs --allow " + gap.purpose + "</code>"
        : "") +
      "</div>\n  </figure>",
  )
  .join("\n");
const html = [
  "<!doctype html>",
  "<html lang=\"en\"><head><meta charset=\"utf-8\"><title>Citadels window purposes</title>",
  "<style>",
  ":root{color-scheme:dark}body{margin:0;background:#272822;color:#f8f8f2;font-family:ui-monospace,monospace}",
  "h1{font-size:14px;letter-spacing:.18em;text-transform:uppercase;padding:16px 20px;margin:0;border-bottom:1px solid #4a4c40}",
  "h1 span{color:#75715e;text-transform:none;letter-spacing:0}",
  "main{display:grid;gap:14px;padding:16px 20px;grid-template-columns:repeat(auto-fill,minmax(420px,1fr))}",
  "figure{margin:0;border:1px solid #4a4c40}video{display:block;width:100%;background:#1e1f1c}",
  "figcaption{display:flex;justify-content:space-between;gap:10px;padding:6px 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#e6db74}",
  "figcaption span{color:#75715e}",
  "figure.gap{border-style:dashed}.gap-body{display:flex;flex-direction:column;gap:8px;padding:14px 12px;font-size:11px;letter-spacing:.08em}",
  ".gap-body b{color:#f92672;text-transform:uppercase;font-size:12px}.gap-body span{color:#75715e;text-transform:uppercase}",
  ".gap-body p{margin:0;color:#f8f8f2;letter-spacing:0;line-height:1.6;text-transform:none}",
  ".gap-body code{color:#a6e22e;text-transform:none;word-break:break-all}",
  "</style></head><body>",
  "<h1>Citadels · " + String(rows.length) + " of " + String(rows.length + gaps.length) + " window purposes · 1920x1080 webm <span>" + (gaps.length === 0 ? "every declared purpose recorded" : gaps.map((gap) => gap.purpose).join(", ") + " has no construction site in the engine") + "</span></h1>",
  "<main>",
  cards,
  gapCards,
  "</main></body></html>",
  "",
].join("\n");
writeFileSync(OUT + "/index.html", html);
const bad = rows.filter((r) => r.width !== 1920 || r.height !== 1080 || r.seconds < 2);
for (const r of rows) {
  console.log((bad.includes(r) ? "BAD  " : "OK   ") + r.purpose.padEnd(22) + r.width + "x" + r.height + " " + r.seconds + "s " + Math.round(r.bytes / 1024) + "KB frames=" + r.frames);
}
console.log("recordings:", rows.length, "gaps:", gaps.map((gap) => gap.purpose).join(", ") || "none", "manifest + gallery written to", OUT);
