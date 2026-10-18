// Proves the window-choice surface: the harness run asserts every panel renders its
// model's controls off a board folded from genesis; the live run asserts the same
// section inside the real /games/<code> surface root and that a tile resolves the
// window.
//
// Usage: node scripts/shots-choice.mjs [--port 3003] [--harness-only]
import { mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { CAST, checkedArgs, createShots, every, originOf, summarize } from "./lib/shots-harness.mjs";

const args = checkedArgs(process.argv.slice(2), ["--port", "--harness-only"]);
const HARNESS_ONLY = args.includes("--harness-only");
const BASE = originOf(args, { defaultPort: 3003 });
const OUT = ".audit/choice";
const CHOICE_KINDS = ["seat", "character", "type", "district", "card", "confirm"];

mkdirSync(OUT, { recursive: true });

const { check, failures, launch, openRoom } = createShots({
  name: "choice",
  base: BASE,
  out: OUT,
  viewport: { width: 1280, height: 900, deviceScaleFactor: 2 },
});

const PROBE = "(() => {const P = \"[data-slot=choice-demo-panel]\", C = \"[data-slot=citadels-choice]\", O = \"[data-slot=citadels-choice-option]\";return [...document.querySelectorAll(P)].map((panel) => ({purpose: panel.getAttribute('data-purpose'), model: Number(panel.getAttribute('data-model-count')), frames: Number(panel.getAttribute('data-frames')),section: panel.querySelector(C) !== null, count: panel.querySelectorAll(O).length,kinds: [...new Set([...panel.querySelectorAll(O)].map((one) => one.getAttribute('data-choice-kind')))],values: [...panel.querySelectorAll(O)].map((one) => one.getAttribute('data-choice-value')),}));})()";
const CLICK = "(() => {const P = \"[data-slot=choice-demo-panel]\", O = \"[data-slot=citadels-choice-option]\", L = \"[data-slot=choice-demo-log]\";const panel = [...document.querySelectorAll(P)].find((one) => one.getAttribute('data-purpose') === 'choose-character');const option = panel.querySelector(O);const card = { label: option.querySelector('span').textContent.trim(), kind: option.getAttribute('data-choice-kind'), value: option.getAttribute('data-choice-value') };option.click();return new Promise((resolve) => setTimeout(() => resolve({ ...card, log: document.querySelector(L).textContent.trim() }), 150));})()";
const RECT = "(() => {const P = \"[data-slot=choice-demo-panel]\";const panel = [...document.querySelectorAll(P)].find((one) => one.getAttribute('data-purpose') === 'warlord-destroy');const box = panel.getBoundingClientRect(); return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) };})()";
const LIVE_FACTS = "(() => {const S = \"[data-slot=citadels-surface]\", C = \"[data-slot=citadels-choice]\", O = \"[data-slot=citadels-choice-option]\";const surface = document.querySelector(S); const inside = surface === null ? null : surface.querySelector(C);const options = inside === null ? [] : [...inside.querySelectorAll(O)];return { surface: surface !== null, insideSurface: inside !== null, purpose: inside === null ? null : inside.getAttribute('data-choice-purpose'),count: options.length, kinds: [...new Set(options.map((one) => one.getAttribute('data-choice-kind')))].filter(Boolean),values: options.map((one) => one.getAttribute('data-choice-value')),labels: options.map((one) => one.textContent.trim()).slice(0, 8),framed: options.length > 0 && options.every((one) => getComputedStyle(one).borderRadius === '0px') };})()";

const harnessRun = async () => {
  const browser = await launch({ label: "harness" });
  try {
    await browser.page.goto(BASE + "/dev/choice-demo", 1800);
    const panels = await browser.page.eval(PROBE);
    check(Array.isArray(panels) && panels.length === 6, "six panels folded from genesis render", String(Array.isArray(panels) ? panels.length : panels));
    for (const panel of panels) {
      const named = `${panel.purpose} (${panel.frames} frames)`;
      check(panel.section, "the choice section renders for " + named);
      check(panel.count === panel.model && panel.model > 0, "the controls match the model for " + named, `${panel.count}/${panel.model}`);
      check(every(panel.kinds, (kind) => CHOICE_KINDS.includes(kind)), "every control carries a kind for " + named, panel.kinds.join(","));
      check(every(panel.values, (value) => typeof value === "string" && value.length > 0), "every control carries a value for " + named, panel.values.join(","));
    }
    const kinds = new Set(panels.flatMap((panel) => panel.kinds));
    check(["seat", "character", "type", "district", "card"].every((kind) => kinds.has(kind)), "seat, character, type, district and card all render", [...kinds].join(","));
    const card = await browser.page.eval(CLICK);
    check(card.log.includes(card.value), "clicking a tile reports its own action", `clicked ${card.kind}/${card.label} -> ${card.log}`);
    await browser.page.shot("panels", { full: true });
    const box = await browser.page.eval(RECT);
    await browser.page.shot("warlord", { clip: { ...box, scale: 2 } });
    console.log("warlord-destroy panel: " + JSON.stringify(box));
    check(browser.errors.length === 0, "the harness page logs no console error", JSON.stringify(browser.errors.slice(0, 3)));
  } finally {
    browser.close();
  }
};

const liveRun = async () => {
  const { code, host, guest } = await openRoom({ room: "choice proof", cast: CAST });
  console.log("room: " + code);

  const seats = [
    { label: "host", browser: await launch({ label: "live-host" }), user: host },
    { label: "guest", browser: await launch({ label: "live-guest" }), user: guest },
  ];
  const choiceThere = "document.querySelector('[data-slot=citadels-surface] [data-slot=citadels-choice]') !== null";
  const pickerThere = "document.querySelector('[data-slot=citadels-picker-card]:not([disabled])') !== null";
  try {
    for (const seat of seats) await seat.browser.page.setCookie(seat.user);
    for (const seat of seats) await seat.browser.page.goto(`${BASE}/games/${code}`);
    for (const seat of seats) {
      if (!(await seat.browser.page.hydrated())) throw new Error(`${seat.label}: the page never hydrated`);
    }
    for (const seat of seats) {
      const entered = await seat.browser.page.clickReal("document.querySelector('[data-slot=citadels-enter]')");
      if (!entered) throw new Error(`${seat.label}: the gate never offered Enter`);
    }
    check(true, "both seats reached the live surface", code);

    const picks = { host: 0, guest: 0 };
    let actor = null;
    for (let i = 0; i < 900 && actor === null; i += 1) {
      for (const seat of seats) {
        if (await seat.browser.page.eval(choiceThere)) { actor = seat; break; }
      }
      if (actor !== null) break;
      let moved = false;
      for (const seat of seats) {
        if (!(await seat.browser.page.eval(pickerThere))) continue;
        const card = await seat.browser.page.clickReal("document.querySelector('[data-slot=citadels-picker-card]:not([disabled])')");
        if (!card) throw new Error(`${seat.label}: no pickable character card`);
        await seat.browser.page.clickReal("document.querySelector('[data-slot=citadels-picker-confirm]')");
        picks[seat.label] += 1;
        moved = true;
      }
      if (moved) continue;
      if (i % 25 === 0) console.log(`waiting: picks ${JSON.stringify(picks)} · host ${await seats[0].browser.page.eval("document.querySelector('[data-slot=citadels-phase]')?.textContent.trim()")}`);
      await delay(300);
    }
    check(picks.host > 0 && picks.guest > 0, "both seats drafted on the live surface", JSON.stringify(picks));
    if (actor === null) throw new Error("no seat reached a window with choices");

    const live = await actor.browser.page.eval(LIVE_FACTS);
    console.log("live choice: " + JSON.stringify(live));
    check(live.insideSurface, "the choice section renders inside the live surface root");
    check(live.count > 0, "the live window offers at least one control", String(live.count));
    check(every(live.kinds, (kind) => CHOICE_KINDS.includes(kind)), "every live control carries a kind", live.kinds.join(","));
    check(every(live.values, (value) => typeof value === "string" && value.length > 0), "every live control carries a value", live.values.join(","));
    check(live.framed, "the live tiles keep square corners");
    await actor.browser.page.shot("live-window");

    if (["choose-character", "choose-seat", "choose-type"].includes(live.purpose)) {
      const other = seats.find((seat) => seat.label !== actor.label);
      const theirs = await other.browser.page.eval(LIVE_FACTS);
      check(!theirs.insideSurface, `the ${live.purpose} window offers nothing to the seat the resolver ignores`, String(theirs.count));
    }

    const picked = live.values[0];
    const clicked = await actor.browser.page.clickReal("document.querySelector('[data-slot=citadels-surface] [data-slot=citadels-choice-option]')");
    check(clicked, "the first live control takes a click", picked);
    const settled = await actor.browser.page.waitFor(
      `!(${choiceThere}) || document.querySelector('[data-slot=citadels-surface] [data-slot=citadels-choice]').getAttribute('data-choice-purpose') !== '${live.purpose}' || document.querySelectorAll('[data-slot=citadels-surface] [data-slot=citadels-choice-option]').length !== ${live.count}`,
      45000,
    );
    check(settled, "reporting the choice resolves the live window", `${live.purpose} ${live.count} -> reporting ${picked}`);
    await actor.browser.page.shot("live-after");
    check(actor.browser.errors.length === 0, "the live surface logs no console error", JSON.stringify(actor.browser.errors.slice(0, 2)));
  } finally {
    for (const seat of seats) seat.browser.close();
  }
};

await harnessRun();
if (!HARNESS_ONLY) await liveRun();
console.log(summarize(failures.length));
process.exit(failures.length === 0 ? 0 : 1);
