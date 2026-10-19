// Drives the picker demo page and writes its two screenshots. The reads are
// printed for a human to compare, not asserted.
import { mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { checkedArgs, createShots, originOf } from "./lib/shots-harness.mjs";

const args = checkedArgs(process.argv.slice(2), ["--port"]);
const BASE = originOf(args, { defaultPort: 3000 });
const OUT = ".audit/pick";
const DEBUG_PORT = 9511;
mkdirSync(OUT, { recursive: true });

const { launch, expectChecks, failures } = createShots({ name: "pick", base: BASE, out: OUT, viewport: { width: 1280, height: 800, deviceScaleFactor: 2 } });
const { page, errors, close } = await launch({ label: "picker", debugPort: DEBUG_PORT });

await page.goto(BASE + "/dev/picker-demo", 2600);
console.log("picker:", await page.eval("(() => { const picker = document.querySelector('[data-slot=citadels-picker]'); if (!picker) return 'no picker'; const cards = [...picker.querySelectorAll('[data-slot=citadels-picker-card]')]; const r = picker.getBoundingClientRect(); const parent = picker.parentElement.getBoundingClientRect(); return JSON.stringify({ cards: cards.length, inset: Math.round(r.left - parent.left) + ',' + Math.round(r.top - parent.top), covers: Math.round(r.width) + 'x' + Math.round(r.height), parent: Math.round(parent.width) + 'x' + Math.round(parent.height), disabled: cards.filter(c => c.disabled).length }); })()"));
await page.shot("picker");
console.log("clicked:", await page.eval("(() => { const c = document.querySelector('[data-slot=citadels-picker-card]:not([disabled])'); if (!c) return 'none'; c.click(); return c.getAttribute('data-character'); })()"));
await delay(600);
console.log("dialog:", await page.eval("(() => { const d = document.querySelector('[data-slot=citadels-picker-dialog]'); if (!d) return 'no dialog'; return JSON.stringify({ role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), ability: d.querySelector('[data-slot=citadels-picker-ability]')?.textContent.trim().slice(0, 70), confirm: d.querySelector('[data-slot=citadels-picker-confirm]')?.textContent.trim(), cancel: !!d.querySelector('[data-slot=citadels-picker-cancel]') }); })()"));
await page.shot("dialog");
close();
expectChecks("picker", 0);
console.log("console errors:", errors.length ? errors.slice(0, 3) : "none");
process.exitCode = failures.length === 0 ? 0 : 1;
