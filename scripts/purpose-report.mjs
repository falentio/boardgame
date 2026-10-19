// Reports what one purpose's page actually draws, and refuses to call it a pass
// unless the page folded THAT purpose. The surface falls back to its own demo board
// when a fold throws, so a drawn board alone proves nothing: the label must carry a
// frame count and the text must not say the engine reached no window.
//
// With no --purpose it walks every purpose in the recordings manifest and writes
// .audit/purpose-webm/windows.tsv: the evidence behind each recording.
import { readFileSync, writeFileSync } from "node:fs";
import { argOf, checkedArgs, createShots, originOf, serverAnswers } from "./lib/shots-harness.mjs";

const args = checkedArgs(process.argv.slice(2), ["--purpose", "--port"]);
const BASE = originOf(args, { defaultPort: 3000 });
const only = argOf(args, "--purpose", null);
if (!(await serverAnswers(BASE))) throw new Error("the dev server on " + BASE + " is not answering; start it before this script");

const purposes = only === null
  ? readFileSync(".audit/purpose-webm/manifest.tsv", "utf8").split("\n").slice(1).map((line) => line.split("\t")[0]).filter((name) => name.length > 0)
  : [only];

const shots = createShots({ name: "purpose-report", base: BASE, out: ".audit/purpose-webm", viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }, detail: "json" });
const { page, close } = await shots.launch({ label: "report", windowSize: { width: 1920, height: 1080 } });

const READ = [
  "(() => {",
  "  const surface = document.querySelector('[data-slot=citadels-surface]');",
  "  return {",
  "    label: document.querySelector('[data-slot=purpose-label]') ? document.querySelector('[data-slot=purpose-label]').innerText : null,",
  "    text: (surface ? surface.innerText : '').replace(/\\s+/g, ' ').trim().slice(0, 300),",
  "    board: document.querySelector('[data-slot=citadels-board]') !== null,",
  "    choices: document.querySelectorAll('[data-slot=citadels-choice-option]').length,",
  "    picks: document.querySelectorAll('[data-slot=citadels-picker-card]').length,",
  "    keeps: document.querySelectorAll('[data-slot=citadels-keep] button').length,",
  "    actions: document.querySelectorAll('[data-slot=citadels-action]').length,",
  "    fitsViewport: document.documentElement.scrollHeight <= window.innerHeight + 1,",
  "  };",
  "})()",
].join("\n");

const rows = [["purpose", "folded", "refused", "choices", "picks", "keeps", "actions", "fits", "frames"].join("\t")];
const bad = [];
for (const purpose of purposes) {
  await page.goto(BASE + "/dev/citadels-interface?p=" + purpose, 600);
  let ready = false;
  for (let i = 0; i < 40 && !ready; i += 1) {
    ready = (await page.eval("window.__purposeReady === true")) === true;
    if (!ready) await new Promise((r) => setTimeout(r, 400));
  }
  const got = await page.eval(READ);
  const label = String(got.label ?? "");
  const text = String(got.text ?? "");
  const upper = label.toUpperCase();
  const folded = /FOLDED IN [0-9]+ FRAMES/.test(upper);
  const frames = folded ? Number(/FOLDED IN ([0-9]+) FRAMES/.exec(upper)[1]) : -1;
  const refused = /REACHED NO/.test(text.toUpperCase());
  const controls = got.choices + got.picks + got.keeps + got.actions;
  const ok = got.board === true && folded && !refused && controls > 0 && got.fitsViewport === true;
  if (!ok) bad.push(purpose);
  rows.push([purpose, folded, refused, got.choices, got.picks, got.keeps, got.actions, got.fitsViewport, frames].join("\t"));
  console.log((ok ? "OK   " : "BAD  ") + purpose.padEnd(22) + "frames=" + String(frames).padEnd(4) + " choices=" + String(got.choices) + " picks=" + String(got.picks) + " keeps=" + String(got.keeps) + " actions=" + String(got.actions) + " fits=" + String(got.fitsViewport));
  if (!ok) console.log("      " + label + " :: " + text.slice(0, 170));
}
close();
if (only === null) {
  writeFileSync(".audit/purpose-webm/windows.tsv", rows.join("\n") + "\n");
  console.log("wrote .audit/purpose-webm/windows.tsv for " + String(purposes.length) + " purposes");
}
console.log(bad.length === 0 ? "ALL " + String(purposes.length) + " PURPOSES FOLD AND DRAW A WINDOW" : "NOT PROVEN: " + bad.join(", "));
