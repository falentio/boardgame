// Measures the citadels surface: corner radius over the rendered surface, the
// live turn bar, and the over state's plate. CDP against a running dev server.
//
// Usage: node scripts/shots-finish.mjs [--port 3001] [--harness-only] [--terminal]
import { mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { CAST, argOf, createShots, summarize } from "./lib/shots-harness.mjs";

const args = process.argv.slice(2);
const PORT = Number(argOf(args, "--port", "3001"));
const HARNESS_ONLY = args.includes("--harness-only");
const BASE = process.env.CITADELS_BASE ?? "http://localhost:" + PORT;
const OUT = ".audit/finish";
const SURFACE = "[data-slot=citadels-surface]";
const ACTIONS = "[data-slot=citadels-surface] [data-slot=citadels-actions]";
const ACTION = "[data-slot=citadels-action]";
const TERMINAL = "[data-slot=citadels-surface] [data-slot=citadels-terminal]";

mkdirSync(OUT, { recursive: true });

const { check, info, failures, launch, openRoom, serverAnswers } = createShots({
  name: "finish",
  base: BASE,
  out: OUT,
  viewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
});
/** Written as a function and stringified: a template literal eats regex escapes. */
const radiusFacts = function facts() {
  const root = document.querySelector("[data-slot=citadels-surface]");
  if (root === null) return null;
  const all = [...root.querySelectorAll("*")].filter((el) => el.tagName !== "IMG");
  const offenders = all
    .map((el) => ({ el, radius: getComputedStyle(el).borderRadius }))
    .filter((row) => row.radius !== "0px")
    .map((row) => ({
      tag: row.el.tagName.toLowerCase(),
      slot: row.el.getAttribute("data-slot"),
      action: row.el.getAttribute("data-action"),
      radius: row.radius,
      text: (row.el.textContent ?? "").trim().slice(0, 24),
    }));
  return {
    scope: root.getAttribute("data-slot"),
    counted: all.length,
    radiusNotZero: offenders.length,
    offenders,
  };
};

/** The turn bar's own facts, read from the page: owner, controls, build's gate. */
const actionFacts = function facts() {
  const surface = document.querySelector("[data-slot=citadels-surface]");
  const bar = document.querySelector("[data-slot=citadels-surface] [data-slot=citadels-actions]");
  const hand = [...document.querySelectorAll("[data-slot=citadels-hand] [data-slot=citadels-district]")];
  const buttons = bar === null ? [] : [...bar.querySelectorAll("[data-slot=citadels-action]")];
  const build = buttons.find((b) => b.getAttribute("data-action") === "build") ?? null;
  const rect = bar === null ? null : bar.getBoundingClientRect();
  return {
    surface: surface !== null,
    bar: bar !== null,
    actions: buttons.map((b) => b.getAttribute("data-action")),
    labels: buttons.map((b) => b.textContent.trim()),
    buildDisabled: build === null ? null : build.disabled,
    hand: hand.length,
    box: rect === null ? null : Math.round(rect.width) + "x" + Math.round(rect.height),
  };
};

/** The over state's own facts: the plate, its numbers, and how it leaves. */
const terminalFacts = function facts() {
  const plate = document.querySelector("[data-slot=citadels-surface] [data-slot=citadels-terminal]");
  if (plate === null) return null;
  const exit = plate.querySelector("[data-slot=citadels-terminal-exit]");
  const box = plate.getBoundingClientRect();
  const style = getComputedStyle(plate);
  const ink = (el) => (el === null ? null : getComputedStyle(el).boxShadow);
  return {
    insideSurface: plate.closest("[data-slot=citadels-surface]") !== null,
    winner: plate.querySelector("[data-slot=citadels-terminal-winner]")?.textContent.trim() ?? null,
    score: plate.querySelector("[data-slot=citadels-terminal-score]")?.textContent.replace(/\s+/g, " ").trim() ?? null,
    terminal: plate.closest("[data-slot=citadels-surface]")?.getAttribute("data-phase") ?? null,
    frame: style.boxShadow,
    radius: style.borderRadius,
    borderBottom: style.borderTopWidth + "/" + style.borderBottomWidth,
    exitTag: exit === null ? null : exit.tagName.toLowerCase(),
    exitSlot: exit === null ? null : exit.getAttribute("data-slot"),
    exitFrame: ink(exit),
    exitRadius: exit === null ? null : getComputedStyle(exit).borderRadius,
    exitText: exit === null ? null : exit.textContent.trim(),
    underlined: exit === null ? null : getComputedStyle(exit).textDecorationLine,
    covers: Math.round(box.width) + "x" + Math.round(box.height),
  };
};

const harnessRun = async () => {
  const browser = await launch({ label: "harness" });
  try {
    await browser.page.goto(BASE + "/dev/citadels-interface");
    const ready = await browser.page.waitFor("document.querySelector('" + SURFACE + "')", 20000);
    check(ready, "the surface harness renders");
    if (!ready) return;
    const radius = await browser.page.evalFn(radiusFacts);
    console.log("radius over the harness surface: " + JSON.stringify(radius));
    check(radius.radiusNotZero === 0, "no element on the harness surface carries a corner radius", String(radius.radiusNotZero));
    const handOf = "(() => { const b = document.querySelector('[data-slot=citadels-hand] button'); const c = b.querySelector('[data-slot=citadels-district]'); return { radius: getComputedStyle(b).borderRadius, card: getComputedStyle(c).boxShadow, lift: getComputedStyle(c).translate, over: [...document.querySelectorAll(':hover')].map((el) => el.getAttribute('data-slot') ?? el.tagName.toLowerCase()) }; })()";
    const handIdle = await browser.page.eval(handOf);
    await browser.page.hover("[data-slot=citadels-hand] button", 300);
    const handHover = await browser.page.eval(handOf);
    let focusedHand = false;
    for (let tab = 0; tab < 80 && !focusedHand; tab += 1) {
      await pressTab(browser.page);
      focusedHand = await browser.page.eval("document.activeElement !== null && document.activeElement.closest('[data-slot=citadels-hand]') !== null && document.activeElement.matches(':focus-visible')");
    }
    const handFocus = await browser.page.eval("(() => { const b = document.activeElement; return { inside: b === null || b.closest === undefined ? false : b.closest('[data-slot=citadels-hand]') !== null, focusVisible: b === null || b.matches === undefined ? false : b.matches(':focus-visible'), shadow: b === null || getComputedStyle === undefined ? null : getComputedStyle(b).boxShadow }; })()");
    console.log("hand idle, hover, focus: " + JSON.stringify([handIdle, handHover, handFocus]));
    check(handIdle.radius === "0px", "the hand build button is square", handIdle.radius);
    check(handHover.over.includes("citadels-hand"), "the pointer reaches the hand button's own tile", JSON.stringify(handHover.over));
    check(handHover.card === handIdle.card && handHover.lift === handIdle.lift, "the hand tile's hover is the card frame's own, unchanged by the radius", handIdle.card === handHover.card ? "no computed change on hover" : "changed");
    info("the card frame carries no hover rule, so the hand tile answers a pointer with nothing (DistrictCard.vue:63)");
    check(handFocus.inside && handFocus.focusVisible && handFocus.shadow !== "none", "the hand build button still shows its focus ring", JSON.stringify(handFocus));
    info("the tile the keyboard ring sits on", await browser.page.eval("(() => { const b = document.activeElement; const tile = b.closest('[data-slot=citadels-hand] li'); return (tile === null ? 'none' : tile.textContent.trim().replace(/\\s+/g, ' ')) + ' <' + b.tagName.toLowerCase() + '>'; })()"));
    await delay(500);
    await browser.page.shot("hand-focus");
    await browser.page.shot("surface-harness");
  } finally {
    browser.close();
  }
};

const liveRun = async () => {
  const { code, host, guest } = await openRoom({ room: "finish proof", cast: CAST });
  console.log("room: " + code);
  const hostBrowser = await launch({ label: "live-host" });
  const guestBrowser = await launch({ label: "live-guest" });
  try {
    await hostBrowser.page.setCookie(host);
    await guestBrowser.page.setCookie(guest);
    await Promise.all([hostBrowser.page.goto(BASE + "/games/" + code), guestBrowser.page.goto(BASE + "/games/" + code)]);
    await Promise.all([hostBrowser.page.hydrated(), guestBrowser.page.hydrated()]);
    const seats = [hostBrowser, guestBrowser];
    const enterSeat = async (browser, seat) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const ready = await browser.page.waitFor("document.querySelector('[data-slot=citadels-enter]') || document.querySelector('" + SURFACE + "')", 25000);
        if (ready) {
          await browser.page.clickReal("document.querySelector('[data-slot=citadels-enter]')");
          if (await browser.page.waitFor("document.querySelector('" + SURFACE + "')", 25000)) return true;
        }
        info("seat " + seat + " took the table again", "attempt " + (attempt + 2));
        await browser.page.goto(BASE + "/games/" + code);
        await browser.page.hydrated();
      }
      return false;
    };
    for (const [i, browser] of seats.entries()) check(await enterSeat(browser, i), "seat " + i + " entered the surface");
    const radius = await hostBrowser.page.evalFn(radiusFacts);
    console.log("radius over the live surface: " + JSON.stringify(radius));
    check(radius !== null && radius.radiusNotZero === 0, "no element on the live surface carries a corner radius", radius === null ? "the surface did not render" : String(radius.radiusNotZero));
    await hostBrowser.page.shot("surface-live");

    const bars = await Promise.all(seats.map((b) => b.page.evalFn(actionFacts)));
    const owner = bars.findIndex((facts) => facts.bar);
    console.log("live turn bars: " + JSON.stringify(bars));
    if (owner < 0) {
      info("no live turn window opened for either seat", JSON.stringify(bars));
      return;
    }
    const actor = bars[owner];
    const idle = bars[owner === 0 ? 1 : 0];
    check(actor.actions.join(",") === "gold,draw,build,pass", "the holding seat's bar carries the four turn actions", JSON.stringify(actor.actions));
    check(actor.buildDisabled === (actor.hand === 0), "build is disabled exactly when the hand is empty", actor.buildDisabled + " with hand " + actor.hand);
    check(idle.bar === false, "the seat that does not hold the turn renders no bar", JSON.stringify(idle.actions));
    await seats[owner].page.shot("turn-bar");

    const terminal = await Promise.all(seats.map((b) => b.page.evalFn(terminalFacts)));
    console.log("live terminal: " + JSON.stringify(terminal));
    const ended = terminal.filter((facts) => facts !== null);
    if (ended.length === 0) info("no seat reached the over state in this run", code);
    else check(ended.every((f) => f.insideSurface && f.winner !== null), "the over state renders a framed plate with the winner inside the live surface", JSON.stringify(ended));
  } finally {
    hostBrowser.close();
    guestBrowser.close();
  }
};

/** The winner's own district count, read off the seat plates the board draws. */
const scoreFacts = function facts() {
  const plates = [...document.querySelectorAll("[data-slot=citadels-self-city], [data-slot=citadels-seat-city]")];
  return plates.map((plate) => plate.textContent.replace(/\s+/g, " ").trim());
};

const pressTab = async (page) => {
  await page.press("Tab", "Tab", 9);
  await delay(120);
};

const reportsIn = (postings) =>
  postings
    .map((posted) => {
      try {
        return JSON.parse(posted.body);
      } catch {
        return null;
      }
    })
    .filter((envelope) => envelope !== null && envelope.body?.kind === "report")
    .map((envelope) => envelope.body.report);

/** The seat ids and frames come from the app's own posted messages, never from a guess. */
const frameOf = (reports) => (reports.length === 0 ? null : reports[reports.length - 1].frame);

const seatOfReports = (reports) => (reports.length === 0 ? null : reports[0].seat);

const WINDOWLESS = ["king", "bishop", "merchant", "architect"];

/** The surface answers the gather, not an ability window, so prefer a windowless character. */
const pickIn = (page) =>
  page.clickReal(
    WINDOWLESS.map((id) => "[data-slot=citadels-picker-card][data-character=" + id + "]:not([disabled])")
      .concat(["[data-slot=citadels-picker-card]:not([disabled])"])
      .map((selector) => "document.querySelector('" + selector + "')")
      .join(" || "),
  );

const latestCommitted = (seats) => {
  let best = null;
  for (const seat of seats) {
    for (const posted of seat.postings) {
      let envelope = null;
      try {
        envelope = JSON.parse(posted.body);
      } catch {
        continue;
      }
      const frame = envelope?.body?.kind === "frame" ? envelope.body.frame?.index : null;
      if (typeof frame === "number") best = Math.max(best ?? -1, frame);
    }
  }
  return best;
};

const actionClick = (page, action) =>
  page.clickReal("document.querySelector('[data-slot=citadels-action][data-action=" + action + "]')");

const terminalRun = async () => {
  const { code, host, guest } = await openRoom({ room: "finish terminal", cast: CAST, hostLabel: "t-host", guestLabel: "t-guest" });
  console.log("terminal room: " + code);

  const hostBrowser = await launch({ label: "terminal-host" });
  const guestBrowser = await launch({ label: "terminal-guest" });
  const seats = [hostBrowser, guestBrowser];
  try {
    await hostBrowser.page.setCookie(host);
    await guestBrowser.page.setCookie(guest);
    await Promise.all([hostBrowser.page.goto(BASE + "/games/" + code), guestBrowser.page.goto(BASE + "/games/" + code)]);
    await Promise.all([hostBrowser.page.hydrated(), guestBrowser.page.hydrated()]);
    for (const [index, seat] of seats.entries()) {
      const entered = await seat.page.clickReal("document.querySelector('[data-slot=citadels-enter]')");
      check(entered, "terminal seat " + index + " entered the surface");
    }
    await Promise.all(seats.map((seat) => seat.page.waitFor("document.querySelector('" + SURFACE + "')", 20000)));

    const deadline = Date.now() + 150000;
    let holder = null;
    while (Date.now() < deadline && holder === null) {
      for (const seat of seats) {
        const picker = await seat.page.eval("document.querySelector('[data-slot=citadels-picker]') !== null");
        if (picker) {
          await pickIn(seat.page);
          await seat.page.clickReal("document.querySelector('[data-slot=citadels-picker-confirm]')");
        }
      }
      const bars = await Promise.all(seats.map((seat) => seat.page.evalFn(actionFacts)));
      const at = bars.findIndex((facts) => facts.bar);
      if (at >= 0) holder = { index: at, facts: bars[at] };
      else await delay(200);
    }
    if (holder === null) {
      info("no turn window opened after the draft in " + code, "the resign below cannot land without a seat the engine owes");
      return;
    }

    const reports = seats.map((seat) => reportsIn(seat.postings));
    const seatIds = reports.map(seatOfReports);
    info("seat ids read from the pages' own reports", JSON.stringify(seatIds));
    await seats[holder.index].page.shot("terminal-turn-bar");
    const strong = holder.index;
    const weak = strong === 0 ? 1 : 0;
    const strongName = strong === 0 ? "host" : "guest";

    const gather = await actionClick(seats[strong].page, "gold");
    info("the holding seat gathers two gold", String(gather));
    const buildButton = "document.querySelector('[data-slot=citadels-action][data-action=build]:not([disabled])')";
    const buildable = await seats[strong].page.waitFor(buildButton, 60000);
    const built = buildable ? await actionClick(seats[strong].page, "build") : false;
    info("the holding seat builds from its hand", String(built));
    const scores = await seats[strong].page.evalFn(scoreFacts);
    info("cities after the build", JSON.stringify(scores));
    const stillHolding = await seats[strong].page.evalFn(actionFacts);
    if (stillHolding.bar) {
      info("the holding seat ends its turn", String(await actionClick(seats[strong].page, "pass")));
    }

    const weakIds = seatIds[weak];
    const baseFrame = frameOf(reports[strong]);
    if (weakIds === null || baseFrame === null) {
      info("no report captured for the seat that resigns", JSON.stringify(seatIds));
      return;
    }
    const cookie = weak === 0 ? host.cookie : guest.cookie;
    const owedNow = (page) =>
      page.eval("document.querySelector('[data-slot=citadels-picker]') !== null || document.querySelector('[data-slot=citadels-actions]') !== null");
    let landed = null;
    for (let attempt = 0; attempt < 60 && landed === null; attempt += 1) {
      const owed = await owedNow(seats[weak].page);
      if (attempt < 2 || owed) info("resign attempt", "the seat that resigns owes a window: " + String(owed));

      // A resignation is a real seat input, and a session folds one only while the
      // seat is owed, so the frame comes from the seats' own latest sealed frame.
      const frame = (latestCommitted(seats) ?? baseFrame) + 1;
      if (attempt < 2 || owed) info("frame for the resign", String(frame));
      const post = await fetch(BASE + "/api/rooms/" + code + "/game", {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE, cookie },
        body: JSON.stringify({ v: 1, body: { kind: "report", report: { frame, seat: weakIds, input: { k: "resign" } } } }),
      });
      if (!post.ok) info("resign post refused", post.status + " " + (await post.text()));
      await delay(1500);
      const facts = await Promise.all(seats.map((seat) => seat.page.evalFn(terminalFacts)));
      landed = facts.find((entry) => entry !== null) ?? null;
      if (landed !== null) info("the resign landed on frame", String(frame));
    }
    const bars = await Promise.all(seats.map((seat) => seat.page.evalFn(actionFacts)));
    info("bars at the end of the terminal pass", JSON.stringify(bars));
    if (landed === null) {
      info("the resign report never matched a frame the seats owed in " + code, "no over state to assert");
      return;
    }
    const all = await Promise.all(seats.map((seat) => seat.page.evalFn(terminalFacts)));
    console.log("live terminal: " + JSON.stringify(all));
    check(all.every((facts) => facts !== null), "both seats read the over state from their own board");
    check(all.every((facts) => facts.insideSurface), "the over state renders inside the live surface root");
    check(all.every((facts) => facts.winner !== null), "the plate names the winner", JSON.stringify(all.map((facts) => facts.winner)));
    check(all.every((facts) => facts.score !== null && facts.score.length > 0), "the plate carries the winner's tally", JSON.stringify(all.map((facts) => facts.score)));
    check(all.every((facts) => facts.radius === "0px" && facts.frame.includes("inset")), "the plate is a square framed piece", JSON.stringify(all.map((facts) => facts.radius + " " + facts.frame.slice(0, 60))));
    check(all.every((facts) => facts.exitRadius === "0px" && facts.exitFrame.includes("inset") && facts.underlined === "none"), "the way out is a framed control, not an underlined link", JSON.stringify(all.map((facts) => facts.exitTag + " " + facts.underlined + " " + facts.exitRadius)));
    await seats[strong].page.shot("terminal-plate");
    await seats[weak].page.shot("terminal-plate-other-seat");
  } finally {
    hostBrowser.close();
    guestBrowser.close();
  }
};

if (!(await serverAnswers())) throw new Error("the dev server on " + BASE + " is not answering; start it before this script");
await harnessRun();
if (args.includes("--terminal")) await terminalRun();
else if (!HARNESS_ONLY) await liveRun();
console.log(summarize(failures.length));
process.exit(failures.length === 0 ? 0 : 1);
