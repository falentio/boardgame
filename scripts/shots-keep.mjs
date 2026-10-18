// Proves the keep-a-card surface: the CDP harness run asserts the drawn pair, the
// pool index each card reports, the non-opaque overlay, and that Escape leaves the
// window untouched; the live run reaches the real /games/<code> surface and
// asserts the turn bar on the seat that holds the turn and no bar on the other seat,
// and asserts the same keep surface inside its root.
//
// Usage: node scripts/shots-keep.mjs [--port 3000] [--harness-only]
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { CAST, checkedArgs, createShots, every, originOf, summarize } from "./lib/shots-harness.mjs";

const args = checkedArgs(process.argv.slice(2), ["--port", "--harness-only"]);
const HARNESS_ONLY = args.includes("--harness-only");
const BASE = originOf(args, { defaultPort: 3000 });
const OUT = ".audit/keep";

mkdirSync(OUT, { recursive: true });

const { check, info, failures, launch, expectChecks, openRoom, serverAnswers } = createShots({
  name: "keep",
  base: BASE,
  out: OUT,
  viewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
});

const KEEP = "[data-slot=citadels-keep]";
const KEEP_CARD = "[data-slot=citadels-keep-card]";
const SURFACE = "[data-slot=citadels-surface]";

/** Written as a function and stringified: a template literal would eat the regex escapes. */
const keepFacts = function facts() {
  const keep = document.querySelector("[data-slot=citadels-keep]");
  if (keep === null) return null;
  const cards = [...keep.querySelectorAll("[data-slot=citadels-keep-card]")];
  const box = keep.getBoundingClientRect();
  const parent = keep.parentElement.getBoundingClientRect();
  const style = getComputedStyle(keep);
  const alphaOf = (color) => {
    const slash = color.match(/\/(\s*[\d.]+)\s*\)$/);
    if (slash !== null) return Number(slash[1]);
    if (color.startsWith("rgba(") || color.startsWith("hsla(")) {
      const comma = color.match(/,\s*([\d.]+)\s*\)$/);
      return comma === null ? 1 : Number(comma[1]);
    }
    return 1;
  };
  const alpha = alphaOf(style.backgroundColor);
  return {
    insideSurface: keep.closest("[data-slot=citadels-surface]") !== null,
    cards: cards.length,
    index: cards.map((card) => card.getAttribute("data-index")),
    district: cards.map((card) => card.getAttribute("data-district")),
    names: [...keep.querySelectorAll("[data-slot=citadels-district] .citadels-district-name")].map((name) => ({
      text: name.textContent.trim(),
      wrap: getComputedStyle(name).overflowWrap,
      clipped: name.scrollWidth > name.clientWidth + 1,
    })),
    covers: Math.round(box.width) + "x" + Math.round(box.height),
    parent: Math.round(parent.width) + "x" + Math.round(parent.height),
    inset: Math.round(box.left - parent.left) + "," + Math.round(box.top - parent.top),
    alpha,
    opaque: alpha === 1,
    background: style.backgroundColor,
    blur: style.backdropFilter,
  };
};

/** The turn bar as the page answers it: the holder's four actions, and build's own gate. */
const actionFacts = function facts() {
  const selector = "[data-slot=citadels-surface] [data-slot=citadels-actions]";
  const bar = document.querySelector(selector);
  const hand = [...document.querySelectorAll("[data-slot=citadels-hand] [data-slot=citadels-district]")];
  const buttons = bar === null ? [] : [...bar.querySelectorAll("[data-slot=citadels-action]")];
  const build = buttons.find((button) => button.getAttribute("data-action") === "build") ?? null;
  const pickedTile = document.querySelector("[data-slot=citadels-hand] [data-picked='true']");
  return {
    selector,
    surface: document.querySelector("[data-slot=citadels-surface]") !== null,
    matched: bar !== null,
    actions: buttons.map((button) => button.getAttribute("data-action")),
    labels: buttons.map((button) => button.textContent.trim()),
    buildDisabled: build === null ? null : build.disabled,
    picked: pickedTile === null ? null : pickedTile.getAttribute("data-index"),
    hand: hand.length,
  };
};

/** The seat the engine owes the turn to is whichever page renders the bar. */
const firstTurnHolder = async (browsers, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const [index, browser] of browsers.entries()) {
      const facts = await browser.page.evalFn(actionFacts);
      if (facts.matched) return { index, facts };
    }
    await delay(300);
  }
  return null;
};


const harnessRun = async () => {
  const browser = await launch({ label: "harness" });
  try {
    await browser.page.goto(BASE + "/dev/keep-demo");
    const ready = await browser.page.waitFor(`document.querySelector('${KEEP_CARD}')`, 20000);
    check(ready, "the harness renders the keep surface");
    if (!ready) return;

    writeFileSync("/tmp/keepfacts-probe.js", "(" + keepFacts.toString() + ")()");
    const window0 = await browser.page.evalFn(keepFacts);
    console.log("keep: " + JSON.stringify(window0));
    check(window0.cards === 2, "exactly two keep cards render", String(window0.cards));
    check(JSON.stringify(window0.index) === JSON.stringify(["0", "1"]), "the cards carry the pool indexes the reducer reads", JSON.stringify(window0.index));
    check(every(window0.district, (id) => typeof id === "string" && id.length > 0), "each card names the district it offers", JSON.stringify(window0.district));
    check(window0.inset === "0,0" && window0.covers === window0.parent, "the surface covers the column it overlays", window0.inset + " " + window0.covers);
    check(!window0.opaque, "the overlay is tinted, not opaque", window0.background);
    check(window0.blur === "blur(2px)", "the overlay blurs the board behind it", window0.blur);
    check(window0.names.length === 2 && every(window0.names, (n) => n.wrap === "anywhere" && !n.clipped), "the card names wrap and never truncate", JSON.stringify(window0.names));
    await browser.page.shot("keep-window");

    await browser.page.press("Escape", "Escape", 27);
    await delay(400);
    const escaped = await browser.page.eval(`(() => ({ keep: !!document.querySelector('${KEEP}'), log: document.querySelector('[data-slot=keep-demo-log]')?.textContent.trim() }))()`);
    check(escaped.keep && escaped.log === "keep none", "Escape leaves the window untouched", JSON.stringify(escaped));
    await browser.page.shot("keep-after-escape");

    const clicked = await browser.page.clickReal(`document.querySelector('${KEEP_CARD}[data-index="1"]')`);
    check(clicked, "the second card takes a click");
    const after = await browser.page.eval(`(() => ({ keep: !!document.querySelector('${KEEP}'), log: document.querySelector('[data-slot=keep-demo-log]')?.textContent.trim() }))()`);
    check(after.log === "keep 1", "clicking the second card reports keep index 1", JSON.stringify(after));
    await browser.page.shot("keep-after-click");
    check(browser.errors.length === 0, "the page logs no console error", JSON.stringify(browser.errors.slice(0, 3)));
  } finally {
    browser.close();
  }
};

const liveRun = async () => {
  const { code, host, guest } = await openRoom({ room: "keep proof", cast: CAST });
  console.log("room: " + code);

  const hostBrowser = await launch({ label: "live-host" });
  const guestBrowser = await launch({ label: "live-guest" });
  const enterSurface = async (browser, label) => {
    const entered = await browser.page.clickReal("document.querySelector('[data-slot=citadels-enter]')");
    if (!entered) throw new Error(label + ": the gate never offered Enter");
    const surface = await browser.page.waitFor("document.querySelector('" + SURFACE + "')", 20000);
    if (!surface) throw new Error(label + ": the surface never came up");
  };

  /** Two seats draft two characters each, alternating, so the picker reopens (state.ts:110). */
  const draftToTurn = async (seats, timeoutMs) => {
    const picks = [0, 0];
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      for (const [index, seat] of seats.entries()) {
        const open = await seat.page.eval("document.querySelector('[data-slot=citadels-picker]') !== null");
        if (!open) continue;
        const picked = await seat.page.clickReal("document.querySelector('[data-slot=citadels-picker-card]:not([disabled])')");
        if (!picked) continue;
        const confirmed = await seat.page.clickReal("document.querySelector('[data-slot=citadels-picker-confirm]')");
        if (confirmed) picks[index] += 1;
      }
      const holder = await firstTurnHolder(seats, 400);
      if (holder !== null) return { holder, picks };
      await delay(150);
    }
    return { holder: null, picks };
  };

  const seats = [hostBrowser, guestBrowser];
  try {
    await hostBrowser.page.setCookie(host);
    await guestBrowser.page.setCookie(guest);
    await Promise.all([
      hostBrowser.page.goto(`${BASE}/games/${code}`),
      guestBrowser.page.goto(`${BASE}/games/${code}`),
    ]);
    await Promise.all([hostBrowser.page.hydrated(), guestBrowser.page.hydrated()]);

    await Promise.all([enterSurface(hostBrowser, "host"), enterSurface(guestBrowser, "guest")]);
    const drafted = await draftToTurn(seats, 90000);
    const holder = drafted.holder;
    info("draft picks the surface accepted per seat (the picker serves one per seat, the rest carry)", JSON.stringify(drafted.picks));

    if (holder === null) {
      const body = await hostBrowser.page.eval("document.body.innerText.split(String.fromCharCode(10)).join(' | ').slice(0, 240)");
      throw new Error("no seat reached the turn window after the draft; host body: " + body);
    }
    const actorBrowser = seats[holder.index];
    const idleBrowser = seats[holder.index === 0 ? 1 : 0];
    const actorName = holder.index === 0 ? "host" : "guest";
    const actor = holder.facts;
    const idle = await idleBrowser.page.evalFn(actionFacts);
    check(
      actor.matched && actor.actions.join(",") === "gold,draw,build,pass",
      "the bar the " + actorName + " holds in room " + code + " carries the four turn actions",
      JSON.stringify({ selector: actor.selector, surface: actor.surface, actions: actor.actions, labels: actor.labels }),
    );
    await actorBrowser.page.clickReal("document.querySelector('[data-slot=citadels-hand] [data-slot=citadels-hand-tile]:not([disabled])')");
    const armed = await actorBrowser.page.evalFn(actionFacts);
    check(
      actor.picked === null && actor.buildDisabled === true && armed.picked !== null,
      "the bar arms build only for a card the player picked in room " + code,
      "before: buildDisabled=" + actor.buildDisabled + " picked=" + actor.picked + "; after a hand pick: picked=" + armed.picked + " buildDisabled=" + armed.buildDisabled,
    );
    check(
      idle.matched === false,
      "the seat that does not hold the turn in room " + code + " matches no turn bar",
      JSON.stringify({ selector: idle.selector, surface: idle.surface, matched: idle.matched, actions: idle.actions }),
    );
    await actorBrowser.page.shot("keep-live-turn");

    const drew = await actorBrowser.page.clickReal("document.querySelector('[data-slot=citadels-action][data-action=draw]')");
    check(drew, "the turn window offers the draw action");

    const opened = await actorBrowser.page.waitFor("document.querySelector('" + KEEP + "')", 15000);
    check(opened, "the keep surface opens on the live board after the draw");
    if (!opened) {
      const body = await actorBrowser.page.eval("document.body.innerText.split(String.fromCharCode(10)).join(' | ').slice(0, 240)");
      console.log("live body: " + body);
      return;
    }

    const live = await actorBrowser.page.evalFn(keepFacts);
    console.log("live keep: " + JSON.stringify(live));
    check(live.insideSurface, "the keep surface renders inside the live surface root");
    check(live.cards === 2, "the live keep offers the two drawn cards", String(live.cards));
    check(JSON.stringify(live.index) === JSON.stringify(["0", "1"]), "the live cards carry indexes 0 and 1", JSON.stringify(live.index));
    check(every(live.district, (id) => typeof id === "string" && id.length > 0), "each live card names a real district", JSON.stringify(live.district));
    check(!live.opaque && live.blur === "blur(2px)", "the live overlay stays tinted and blurred", live.background + " alpha " + live.alpha + " " + live.blur);
    check(live.names.length === 2 && every(live.names, (n) => n.wrap === "anywhere" && !n.clipped), "the live card names wrap and never truncate", JSON.stringify(live.names));
    await actorBrowser.page.shot("keep-live-window");

    const handBefore = await actorBrowser.page.eval("document.querySelectorAll('[data-slot=citadels-hand] [data-slot=citadels-district]').length");
    const kept = await actorBrowser.page.clickReal(`document.querySelector('${KEEP_CARD}[data-index="1"]')`);
    check(kept, "the second live card takes a click");
    const gone = await actorBrowser.page.waitFor("document.querySelector('" + KEEP + "') === null", 15000);
    check(gone, "keeping a card closes the live window");
    const handAfter = await actorBrowser.page.eval("document.querySelectorAll('[data-slot=citadels-hand] [data-slot=citadels-district]').length");
    check(handAfter === handBefore + 1, "the kept card joined the hand", handBefore + " -> " + handAfter);
    await actorBrowser.page.shot("keep-live-kept");
  } finally {
    hostBrowser.close();
    guestBrowser.close();
  }
};

if (!(await serverAnswers())) throw new Error("the dev server on " + BASE + " is not answering; start it before this script");
await harnessRun();
expectChecks("harness", 12);
if (!HARNESS_ONLY) {
  try {
    await liveRun();
  } catch (error) {
    check(false, "the live surface run completed", String(error.message ?? error));
  }
  expectChecks("live", 14);
}
console.log(summarize(failures.length));
process.exit(failures.length === 0 ? 0 : 1);
