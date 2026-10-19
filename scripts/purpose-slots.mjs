// Prints the data-slot census of one purpose's page: what the surface actually
// drew, by slot, with counts. Used to tell a wrong probe from an empty surface.
import { argOf, checkedArgs, createShots, originOf, serverAnswers } from "./lib/shots-harness.mjs";

const args = checkedArgs(process.argv.slice(2), ["--purpose", "--port"]);
const BASE = originOf(args, { defaultPort: 3000 });
const purpose = argOf(args, "--purpose", null);
if (purpose === null) throw new Error("--purpose <purpose> is required");
if (!(await serverAnswers(BASE))) throw new Error("the dev server on " + BASE + " is not answering");

const shots = createShots({ name: "purpose-slots", base: BASE, out: ".audit/purpose-webm", viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 } });
const { page, close } = await shots.launch({ label: "slots", windowSize: { width: 1920, height: 1080 } });
await page.goto(BASE + "/dev/citadels-interface?p=" + purpose, 600);
let ready = false;
for (let i = 0; i < 40 && !ready; i += 1) {
  ready = (await page.eval("window.__purposeReady === true")) === true;
  if (!ready) await new Promise((r) => setTimeout(r, 400));
}
const census = await page.eval("Array.from(document.querySelectorAll(String.fromCharCode(91) + 'data-slot' + String.fromCharCode(93))).map((el) => el.getAttribute('data-slot')).reduce((acc, k) => { acc[k] = (acc[k] || 0) + 1; return acc; }, {})");
console.log("purpose:", purpose);
console.log("census:", JSON.stringify(census, null, 0));
const text = await page.eval("(document.querySelector('[data-slot=citadels-surface]') || document.body).innerText.replace(/\\s+/g, ' ').slice(0, 320)");
console.log("text:", String(text));
close();
