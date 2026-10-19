// Concatenates the purpose recordings into one film: a title card, then every
// recording in manifest order. Each clip already names the window it shows, so
// the film reads as a labelled tour instead of 29 anonymous boards.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const OUT = resolve(process.argv[2] ?? ".audit/purpose-webm");
const TITLE_SECONDS = 2.5;
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf";

const rows = readFileSync(join(OUT, "manifest.tsv"), "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((line) => line.split("\t"))
  .map(([purpose, , , seconds, , , file]) => ({ purpose, seconds: Number(seconds), file }));
const missing = rows.filter((row) => !row.file.endsWith(".webm"));
if (missing.length > 0) throw new Error("manifest holds a file that is not a recording: " + missing[0].file);

const work = mkdtempSync(join(tmpdir(), "purpose-concat-"));
const title = join(work, "title.webm");
const line = (text, size, colour, y) =>
  "drawtext=fontfile=" + FONT + ":text='" + text + "':fontcolor=" + colour + ":fontsize=" + size + ":x=(w-text_w)/2:y=" + y;
execFileSync("ffmpeg", [
  "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=0x272822:s=1920x1080:r=30:d=" + TITLE_SECONDS,
  "-vf", [
    line("CITADELS", 96, "0xf8f8f2", 400),
    line("29 WINDOW PURPOSES", 44, "0xa6e22e", 540),
    line("1920x1080 webm, one clip per purpose", 26, "0xe6db74", 620),
    line("queen-income has no construction site in the engine", 22, "0x75715e", 680),
  ].join(","),
  "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-row-mt", "1", "-pix_fmt", "yuv420p", title,
]);

const list = join(work, "list.txt");
writeFileSync(
  list,
  [title, ...rows.map((row) => join(OUT, row.file))].map((path) => "file '" + path + "'").join("\n") + "\n",
);

const encode = (name, codec) => {
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list,
    "-fps_mode", "cfr", "-r", "30", "-an", ...codec, join(OUT, name),
  ], { stdio: ["ignore", "ignore", "inherit"] });
};
encode("all-purposes.webm", ["-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "3", "-pix_fmt", "yuv420p"]);
encode("all-purposes.mp4", ["-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]);
rmSync(work, { recursive: true, force: true });

const expected = TITLE_SECONDS + rows.reduce((sum, row) => sum + row.seconds, 0);
for (const name of ["all-purposes.webm", "all-purposes.mp4"]) {
  const path = join(OUT, name);
  const probe = JSON.parse(execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "stream=width,height", "-show_entries", "format=duration,size", "-of", "json", path,
  ], { encoding: "utf8" }));
  const { width, height } = probe.streams[0];
  const seconds = Number(Number(probe.format.duration).toFixed(2));
  const ok = width === 1920 && height === 1080 && Math.abs(seconds - expected) < 2;
  console.log((ok ? "OK   " : "BAD  ") + name.padEnd(20) + width + "x" + height + " " + seconds + "s " + Math.round(Number(probe.format.size) / 1048576) + "MB, expected about " + expected.toFixed(1) + "s");
  if (!ok) process.exitCode = 1;
}
console.log("film:", rows.length, "clips after a", TITLE_SECONDS + "s title card");
