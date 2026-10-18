// Proves the Citadels motion pass on the real surface: per-element transition
// values, the mid-flight frame of an overlay, the reduced-motion pair, and the
// hover gate measured in both directions. Boards come from the engine, projected
// through citadelsBoardOf by the /dev/motion-demo page.
//
// Usage: node scripts/shots-motion.mjs [--port 3001]
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};
const PORT = Number(argOf("--port", "3001"));
const BASE = "http://localhost:" + PORT;
const OUT = ".audit/motion/";
const DEBUG_PORT = 9551;
const POINTER_FLAGS = "--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4";
const RULE = "rgb(230, 219, 116)";
mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (ok, label, detail) => {
  if (!ok) failures += 1;
  console.log((ok ? "PASS " : "FAIL ") + label + (detail === undefined ? "" : " :: " + detail));
};
const note = (label, detail) => console.log("     " + label + (detail === undefined ? "" : " :: " + detail));
const partsOf = (value) => String(value).split(",").map((part) => part.trim());
const easingsOf = (value) => String(value).split(/,\s(?=[a-z])/).map((part) => part.trim());

/** The scale and opacity the browser reports for a held transition sample. */
const midFlight = (held) => {
  const match = /matrix\(([0-9.]+)/.exec(String(held.transform));
  const scale = match === null ? null : Number(match[1]);
  const opacity = Number(held.opacity);
  return { scale: scale, opacity: opacity, partial: scale !== null && scale > 0.97 && scale < 1 && opacity > 0 && opacity < 1 };
};

const launch = async (options = {}) => {
  const profile = "/tmp/motion-" + Date.now() + "-" + Math.round(Math.random() * 1000000);
  const debugPort = options.debugPort ?? DEBUG_PORT;
  rmSync(profile, { recursive: true, force: true });
  const flags = ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--user-data-dir=" + profile, "--remote-debugging-port=" + debugPort, "--remote-allow-origins=*"];
  if (options.finePointer === true) flags.push(POINTER_FLAGS);
  flags.push("about:blank");
  const chrome = spawn("/usr/bin/google-chrome", flags, { stdio: "ignore" });
  let wsUrl = null;
  for (let i = 0; i < 80 && !wsUrl; i += 1) {
    try {
      const res = await fetch("http://127.0.0.1:" + debugPort + "/json/version");
      if (res.ok) wsUrl = (await res.json()).webSocketDebuggerUrl;
    } catch {}
    if (!wsUrl) await delay(250);
  }
  if (wsUrl === null) throw new Error("chrome never exposed a debug endpoint");
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    else if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") errors.push(message.params.args.map((a) => a.value ?? a.description).join(" "));
  };
  const send = (method, params = {}, sessionId) => new Promise((res) => {
    const at = ++id;
    pending.set(at, res);
    ws.send(JSON.stringify({ id: at, method, params, sessionId }));
  });
  const created = (await send("Target.createTarget", { url: "about:blank" })).result;
  const attached = (await send("Target.attachToTarget", { targetId: created.targetId, flatten: true })).result;
  const session = attached.sessionId;
  await send("Page.enable", {}, session);
  await send("Runtime.enable", {}, session);
  await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 2, mobile: false }, session);
  const page = {
    errorsFor: () => errors.splice(0, errors.length),
    async eval(expression) {
      const message = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, session);
      if (message.result.exceptionDetails) {
        const details = message.result.exceptionDetails;
        throw new Error((details.exception && details.exception.description) || details.text);
      }
      return message.result.result.value;
    },
    read: (selector) => page.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (el === null) return null; const s = getComputedStyle(el); return { tag: el.tagName.toLowerCase(), prop: s.transitionProperty, dur: s.transitionDuration, ease: s.transitionTimingFunction, transform: s.transform, translate: s.translate, opacity: s.opacity, shadow: s.boxShadow, outlineColor: s.outlineColor, borderColor: s.borderTopColor, color: s.color }; })()"),
    async goto(url, waitMs = 2600) { await send("Page.navigate", { url }, session); await delay(waitMs); },
    async waitFor(expression, timeoutMs = 20000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) { if (await page.eval("!!(" + expression + ")")) return true; await delay(150); }
      return false;
    },
    async media(features) { await send("Emulation.setEmulatedMedia", { media: "screen", features }, session); await delay(150); },
    async hover(selector) {
      const box = await page.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); if (el === null) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()");
      if (box === null) return false;
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.x, y: box.y, buttons: 0 }, session);
      await delay(320);
      return true;
    },
    async unhover() { await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2, buttons: 0 }, session); await delay(260); },
    async shot(name) {
      const png = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, session);
      writeFileSync(OUT + name + ".png", Buffer.from(png.result.data, "base64"));
      return OUT + name + ".png";
    },
  };
  return { page, close: () => { try { ws.close(); } catch {} try { process.kill(-chrome.pid); } catch {} try { chrome.kill("SIGKILL"); } catch {} try { rmSync(profile, { recursive: true, force: true }); } catch {} } };
};

/** Pause the overlay's running transition and seek it to \`seek\` ms. */
const HOLD =
  "  const held = await new Promise((resolve) => {\n" +
  "    let frames = 0;\n" +
  "    const tick = () => {\n" +
  "      const el = document.querySelector('[data-slot=SLOT]');\n" +
  "      const live = el === null ? [] : document.getAnimations().filter((a) => a.effect && a.effect.target === el);\n" +
  "      if (live.length > 0 || frames > 60) resolve({ el: el, live: live, frames: frames });\n" +
  "      else { frames += 1; requestAnimationFrame(tick); }\n" +
  "    };\n" +
  "    tick();\n" +
  "  });\n" +
  "  window.__frozen = held.live;\n" +
  "  for (const a of held.live) { a.pause(); a.currentTime = SEEK; }\n" +
  "  const s = held.el === null ? null : getComputedStyle(held.el);\n" +
  "  return JSON.stringify({ scene: 'SCENE', transitions: held.live.length, framesWaited: held.frames, settledOn: document.querySelector('[data-slot=citadels-surface]').getAttribute('data-scene'), seekedTo: held.live.map((a) => Math.round(a.currentTime)), opacity: s === null ? null : s.opacity, transform: s === null ? null : s.transform, prop: s === null ? null : s.transitionProperty, dur: s === null ? null : s.transitionDuration, ease: s === null ? null : s.transitionTimingFunction });\n" +
  "})()";

const fill = (template, slot, scene, seek) =>
  template.replace("SLOT", slot).replaceAll("SCENE", scene).replace("SEEK", String(seek));

/** Close any open overlay, show the scene again, then hold its entrance. */
const holdEnter = (page, scene, slot, seek = 60) =>
  page.eval(
    fill(
      "(async () => {\n  const wait = () => new Promise((r) => setTimeout(r, 340));\n  document.querySelector('[data-slot=motion-demo-scene][data-scene=turn]').click();\n  await wait();\n  document.querySelector('[data-slot=motion-demo-scene][data-scene=SCENE]').click();\n" + HOLD,
      slot,
      scene,
      seek,
    ),
  );

/** With the overlay open, move the scene on and hold its exit. */
const holdLeave = (page, scene, slot, seek = 60) =>
  page.eval(fill("(async () => {\n  document.querySelector('[data-slot=motion-demo-scene][data-scene=SCENE]').click();\n" + HOLD, slot, scene, seek));

const release = (page) => page.eval("(() => { const live = window.__frozen ?? []; for (const a of live) a.play(); window.__frozen = []; return live.length; })()");
const showScene = (page, scene) => page.eval("(async () => { document.querySelector('[data-slot=motion-demo-scene][data-scene=" + scene + "]').click(); await new Promise((r) => setTimeout(r, 400)); return true; })()");

/** Idle and hovered reads of one element, with the pointer left on it. */
const readHover = async (page, selector) => {
  const idle = await page.read(selector);
  await page.hover(selector);
  const over = await page.read(selector);
  return { idle, over };
};

/** The same hover probes in a browser that reports a fine pointer. */
const finePointerPass = async () => {
  console.log("");
  console.log("== 4b. the same probes with a fine pointer ==");
  const browser = await launch({ finePointer: true, debugPort: DEBUG_PORT + 1 });
  const page = browser.page;
  try {
    await page.goto(BASE + "/dev/motion-demo");
    const ready = await page.waitFor("document.querySelector('[data-slot=citadels-surface]')");
    check(ready, "the motion harness renders in the fine-pointer browser");
    if (!ready) return;
    await showScene(page, "turn");
    const media = await page.eval("(() => ({ hover: matchMedia('(hover: hover) and (pointer: fine)').matches, reduce: matchMedia('(prefers-reduced-motion: reduce)').matches }))()");
    note("fine-pointer browser media features", JSON.stringify(media));
    check(media.hover, "this browser reports (hover: hover) and (pointer: fine)");
    const { idle: tileIdle, over: tileOver } = await readHover(page, "[data-slot=citadels-action][data-action=gold]");
    await page.shot("turn-bar-hover-fine-pointer");
    await page.unhover();
    const { idle: handIdle, over: handOver } = await readHover(page, "[data-slot=citadels-hand-tile]");
    const cardIdle = await page.read("[data-slot=citadels-hand] [data-slot=citadels-district]");
    const cardOver = await page.read("[data-slot=citadels-hand] [data-slot=citadels-district]");
    await page.shot("hand-hover-fine-pointer");
    await page.unhover();
    const { idle: seatIdle, over: seatOver } = await readHover(page, "[data-slot=citadels-seat]");
    await page.shot("seat-hover-fine-pointer");
    await page.unhover();
    console.log("   turn tile: " + JSON.stringify({ idle: tileIdle.translate, hover: tileOver.translate, ink: tileOver.borderColor }));
    console.log("   hand tile: " + JSON.stringify({ idle: handIdle.translate, hover: handOver.translate, ink: handOver.outlineColor }));
    console.log("   card in hand: " + JSON.stringify({ shadow: String(cardIdle.shadow).slice(0, 40), translate: cardIdle.translate, hoverTranslate: cardOver.translate }));
    console.log("   seat card: " + JSON.stringify({ idle: seatIdle.translate, hover: seatOver.translate, ink: String(seatOver.shadow).slice(0, 58) }));
    check(tileOver.translate === "0px -1px" && tileIdle.translate !== "0px -1px", "a fine pointer lifts the turn tile 1px", tileIdle.translate + " -> " + tileOver.translate);
    check(handOver.translate === "0px -1px" && handOver.outlineColor === RULE, "a fine pointer lifts the hand tile and inks its edge", handOver.translate + " " + handOver.outlineColor);
    check(cardOver.translate === cardIdle.translate && cardOver.shadow === cardIdle.shadow, "the card inside the hand tile stays still", String(cardOver.translate));
    check(seatOver.translate === "none" || seatOver.translate === "0px", "the seat card changes colour only, as the gate asks", String(seatOver.translate));
    check(String(seatOver.shadow).includes(RULE), "the seat card still answers with yellow ink", String(seatOver.shadow).slice(0, 58));
    await showScene(page, "draft");
    await page.eval("(() => { const p = document.querySelector('[data-slot=citadels-picker]'); if (p !== null) p.style.visibility = 'hidden'; return true; })()");
    const rowIdle = await page.read("[data-slot=citadels-cast-row]");
    await page.hover("[data-slot=citadels-cast-row]");
    const rowOver = await page.read("[data-slot=citadels-cast-row]");
    await page.shot("cast-row-hover-fine-pointer");
    console.log("   cast row: " + JSON.stringify({ tag: rowIdle.tag, idle: rowIdle.translate, hover: rowOver.translate, ink: String(rowOver.shadow).slice(0, 46) }));
    check(rowOver.translate === "none" || rowOver.translate === "0px", "a pickable cast row changes ink and never moves", String(rowOver.translate));
    check(String(rowOver.shadow).includes(RULE), "a pickable cast row still answers with yellow ink", String(rowOver.shadow).slice(0, 46));
    await page.eval("(() => { const p = document.querySelector('[data-slot=citadels-picker]'); if (p !== null) p.style.visibility = ''; return true; })()");
    await page.unhover();
    await showScene(page, "turn");
    await page.media([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.hover("[data-slot=citadels-action][data-action=gold]");
    const reducedHover = await page.read("[data-slot=citadels-action][data-action=gold]");
    await page.shot("turn-bar-hover-fine-pointer-reduced");
    await page.unhover();
    console.log("   turn tile with a fine pointer under reduce: " + JSON.stringify({ translate: reducedHover.translate, ink: reducedHover.borderColor }));
    check(reducedHover.translate !== "0px -1px" && reducedHover.borderColor === RULE, "under reduce a fine pointer keeps the ink and drops the lift", String(reducedHover.translate) + " " + reducedHover.borderColor);
    const errors = page.errorsFor();
    check(errors.length === 0, "the fine-pointer browser logs no console error", JSON.stringify(errors.slice(0, 3)));
  } finally {
    browser.close();
  }
};

const main = async () => {
  const browser = await launch();
  const page = browser.page;
  try {
    await page.goto(BASE + "/dev/motion-demo");
    const ready = await page.waitFor("document.querySelector('[data-slot=citadels-surface]')");
    check(ready, "the motion harness renders the surface root");
    if (!ready) return;
    const shape = await page.eval("(() => { const root = document.querySelector('[data-slot=citadels-surface]'); const box = root.getBoundingClientRect(); return JSON.stringify({ scenes: [...document.querySelectorAll('[data-slot=motion-demo-scene]')].map((b) => b.getAttribute('data-scene')), scene: root.getAttribute('data-scene'), purpose: root.getAttribute('data-scene-purpose'), frames: root.getAttribute('data-scene-frames'), choices: root.getAttribute('data-scene-choices'), covers: Math.round(box.width) + 'x' + Math.round(box.height) }); })()");
    console.log("engine-folded scenes: " + shape);
    const folded = JSON.parse(shape);
    check(folded.scenes.length === 4 && folded.scene === "draft" && folded.frames === "0" && folded.purpose === "draft-pick", "every scene folds from the engine, opening on the draft", shape);
    const media = await page.eval("(() => ({ hover: matchMedia('(hover: hover) and (pointer: fine)').matches, any: matchMedia('(any-hover: hover)').matches, pointer: matchMedia('(pointer: fine)').matches, reduce: matchMedia('(prefers-reduced-motion: reduce)').matches }))()");
    note("headless media features", JSON.stringify(media));

    console.log("");
    console.log("== 1. transition values per animated element ==");
    await showScene(page, "turn");
    const values = [];
    for (const [label, changes, selector] of [
      ["turn tile", "enter: frame ink + 1px lift, press: scale; leave: ink back", "[data-slot=citadels-action]"],
      ["cast row", "enter/leave: state ink ring, colour + background", "[data-slot=citadels-cast-row]"],
      ["cast state plate", "enter/leave: the state flag's own plate colour", "[data-slot=citadels-cast-flag]"],
      ["seat card", "enter/leave: focus and hover ink only", "[data-slot=citadels-seat]"],
      ["seat gold plate", "enter/leave: count ink", "[data-slot=citadels-seat-gold]"],
      ["hand tile", "enter: edge ink + 1px lift, leave: edge ink out", "[data-slot=citadels-hand-tile]"],
    ]) {
      const read = await page.read(selector);
      values.push([label, read]);
      console.log("   " + label + " (" + changes + "): " + JSON.stringify(read));
    }
    const layout = ["all", "width", "height", "margin", "padding", "top", "left", "inset"];
    const offenders = [];
    for (const [label, value] of values) {
      if (value === null) { offenders.push(label + " missing from the turn scene"); continue; }
      const named = partsOf(value.prop).filter((prop) => layout.includes(prop));
      if (named.length > 0) offenders.push(label + " animates " + named.join(", "));
    }
    check(offenders.length === 0, "every animated element names its properties, none a layout property", JSON.stringify(offenders));

    const pickerEnter = JSON.parse(await holdEnter(page, "draft", "citadels-picker"));
    const midShot = await page.shot("overlay-enter-60ms");
    await release(page);
    console.log("   picker overlay (enter: mount, leave: unmount) held at 60ms: " + JSON.stringify(pickerEnter));
    const enterMid = midFlight(pickerEnter);
    check(pickerEnter.transitions >= 2 && enterMid.partial, "the picker is still mid-flight at 60ms: partial opacity and a scale between 0.97 and 1", JSON.stringify(enterMid) + " " + midShot);
    check(partsOf(pickerEnter.dur).every((part) => part === "0.18s") && easingsOf(pickerEnter.ease).every((part) => part === "cubic-bezier(0.23, 1, 0.32, 1)"), "the overlay runs 180ms on the board's own ease-out token", pickerEnter.dur + " | " + pickerEnter.ease);
    check(pickerEnter.seekedTo.every((at) => at === 60), "the captured frame is the 60ms sample of the browser's own timeline", JSON.stringify(pickerEnter.seekedTo));

    const pickerLeave = JSON.parse(await holdLeave(page, "turn", "citadels-picker"));
    const leaveShot = await page.shot("overlay-leave-60ms");
    await release(page);
    console.log("   picker overlay leave held at 60ms: " + JSON.stringify(pickerLeave));
    const leaveMid = midFlight(pickerLeave);
    check(pickerLeave.transitions >= 2 && leaveMid.partial && leaveMid.opacity === enterMid.opacity && leaveMid.scale === enterMid.scale, "the exit mirrors the entry: the same opacity and scale at the same 60ms", JSON.stringify(leaveMid) + " " + leaveShot);
    const gone = await page.waitFor("document.querySelector('[data-slot=citadels-picker]') === null", 4000);
    check(gone, "the picker leaves the DOM when the scene moves on");

    const keepEnter = JSON.parse(await holdEnter(page, "keep", "citadels-keep"));
    const keepShot = await page.shot("keep-enter-60ms");
    await release(page);
    check(keepEnter.transitions >= 2 && Number(keepEnter.opacity) < 1, "the keep window enters on the same transition", keepShot + " " + JSON.stringify(keepEnter));
    const choiceEnter = JSON.parse(await holdEnter(page, "choice", "citadels-choice"));
    const choiceShot = await page.shot("choice-enter-60ms");
    await release(page);
    check(choiceEnter.transitions >= 2 && Number(choiceEnter.opacity) < 1, "the choice rail enters on the same transition", choiceShot + " " + JSON.stringify(choiceEnter));

    console.log("");
    console.log("== 2. state indication on the cast rows ==");
    await showScene(page, "draft");
    const draftRow = await page.read("[data-slot=citadels-cast-row][data-state=faceup]");
    await showScene(page, "turn");
    const turnRow = await page.read("[data-slot=citadels-cast-row][data-state=pending]");
    console.log("   faceup row ink: " + draftRow.shadow);
    console.log("   pending row ink: " + turnRow.shadow);
    check(draftRow.shadow !== turnRow.shadow, "the row ink differs between two engine states", turnRow.shadow.slice(0, 40));
    check(partsOf(turnRow.prop).includes("box-shadow") && partsOf(turnRow.dur).every((part) => part === "0.15s") && easingsOf(turnRow.ease).every((part) => part === "ease"), "a row repaints its ink over 150ms ease instead of snapping", turnRow.prop + " | " + turnRow.dur + " | " + turnRow.ease);

    console.log("");
    console.log("== 3. hover gate, both directions ==");
    const gate = /\(hover: hover\) and \(pointer: fine\) and \(prefers-reduced-motion: no-preference\)/;
    const blockOf = (source) => {
      const at = source.search(gate);
      if (at === -1) return "none";
      const open = source.indexOf("{", at);
      let depth = 0;
      let end = open;
      for (let i = open; i < source.length; i += 1) {
        if (source[i] === "{") depth += 1;
        else if (source[i] === "}") { depth -= 1; if (depth === 0) { end = i; break; } }
      }
      return source.slice(at, end + 1).split("\n").map((line) => line.trim()).join(" ");
    };
    const skinSource = readFileSync("app/components/citadels/board/citadels-skin.css", "utf8");
    const tileSource = readFileSync("app/components/citadels/board/CitadelsActions.vue", "utf8");
    const handSource = readFileSync("app/components/citadels/board/CitadelsHand.vue", "utf8");
    console.log("   skin gate: " + blockOf(skinSource));
    console.log("   tile gate: " + blockOf(tileSource));
    console.log("   hand gate: " + blockOf(handSource));
    check([skinSource, tileSource, handSource].every((source) => blockOf(source).includes("translate")), "the 1px lift sits inside (hover: hover) and (pointer: fine), in the skin, the turn tile and the hand tile");
    const ungated = /:hover:not\(:disabled\) \{\n\s+border-color: var\(--monokai-yellow\);\n\s+color: var\(--monokai-yellow\);/.test(tileSource);
    console.log("   tile colour rule written outside the query: " + String(ungated));
    check(ungated, "the tile's colour change is written outside the media query");

    const { idle: tileIdle, over: tileOver } = await readHover(page, "[data-slot=citadels-action][data-action=gold]");
    await page.unhover();
    console.log("   tile idle: " + JSON.stringify({ borderColor: tileIdle.borderColor, color: tileIdle.color, translate: tileIdle.translate }));
    console.log("   tile hover: " + JSON.stringify({ borderColor: tileOver.borderColor, color: tileOver.color, translate: tileOver.translate }));
    check(tileOver.borderColor === RULE && tileOver.color === RULE, "with no hover media the tile still turns its frame and ink yellow", tileOver.borderColor);
    check(tileOver.translate === "none" || tileOver.translate === "0px", "with no hover media the tile does not move", String(tileOver.translate));

    const { idle: handIdle, over: handOver } = await readHover(page, "[data-slot=citadels-hand-tile]");
    const cardOver = await page.read("[data-slot=citadels-hand] [data-slot=citadels-district]");
    await page.shot("hand-hover-no-hover-media");
    await page.unhover();
    check(handIdle.outlineColor !== RULE && handOver.outlineColor === RULE, "the hand tile inks its edge yellow wherever the pointer is", handIdle.outlineColor + " -> " + handOver.outlineColor);
    check(handOver.translate === "none" || handOver.translate === "0px", "the hand tile does not move without a fine pointer", String(handOver.translate));
    check(String(cardOver.translate) === "none" && String(cardOver.shadow).includes("inset"), "the card inside the tile keeps its own frame and stays still", String(cardOver.shadow).slice(0, 58));

    note("headless refuses (hover: hover) emulation", "the same probes run again with a fine pointer below");

    console.log("");
    console.log("== 4. reduced motion ==");
    await page.media([{ name: "prefers-reduced-motion", value: "reduce" }]);
    const reducedMedia = await page.eval("(() => ({ reduce: matchMedia('(prefers-reduced-motion: reduce)').matches }))()");
    const reducedRow = await page.read("[data-slot=citadels-cast-row]");
    const reducedSeat = await page.read("[data-slot=citadels-seat]");
    const reducedTile = await page.read("[data-slot=citadels-action]");
    const reducedHand = await page.read("[data-slot=citadels-hand-tile]");
    const reducedEnter = JSON.parse(await holdEnter(page, "draft", "citadels-picker"));
    const reducedShot = await page.shot("overlay-enter-60ms-reduced");
    await release(page);
    console.log("   reduce matches: " + JSON.stringify(reducedMedia));
    console.log("   reduce turn tile: " + JSON.stringify({ prop: reducedTile.prop, dur: reducedTile.dur, ease: reducedTile.ease }));
    console.log("   reduce cast row: " + JSON.stringify({ prop: reducedRow.prop, dur: reducedRow.dur, ease: reducedRow.ease }));
    console.log("   reduce seat card: " + JSON.stringify({ prop: reducedSeat.prop }));
    console.log("   reduce hand tile: " + JSON.stringify({ prop: reducedHand.prop }));
    console.log("   reduce overlay at 60ms: " + JSON.stringify(reducedEnter));
    console.log("   PAIR picker overlay   full-run: " + JSON.stringify({ transform: pickerEnter.transform, opacity: pickerEnter.opacity, prop: pickerEnter.prop }));
    console.log("   PAIR picker overlay    reduce: " + JSON.stringify({ transform: reducedEnter.transform, opacity: reducedEnter.opacity, prop: reducedEnter.prop }));
    console.log("   PAIR cast row          full-run: " + JSON.stringify({ prop: turnRow.prop }));
    console.log("   PAIR cast row           reduce: " + JSON.stringify({ prop: reducedRow.prop }));
    console.log("   PAIR turn tile         full-run: " + JSON.stringify({ prop: tileOver.prop }));
    console.log("   PAIR turn tile          reduce: " + JSON.stringify({ prop: reducedTile.prop }));
    check(reducedMedia.reduce, "the browser reports prefers-reduced-motion: reduce");
    check(reducedEnter.transform === "none" && Number(reducedEnter.opacity) > 0 && Number(reducedEnter.opacity) < 1, "under reduce the overlay keeps the fade and drops the scale", reducedShot);
    check(partsOf(reducedEnter.prop).join(", ") === "opacity" && partsOf(reducedRow.prop).join(", ") === "box-shadow, background-color, color" && !partsOf(reducedTile.prop).some((prop) => prop === "translate" || prop === "scale") && !partsOf(reducedHand.prop).some((prop) => prop === "translate"), "under reduce no transform stays in a transition list and every ink transition stays", JSON.stringify({ overlay: reducedEnter.prop, castRow: reducedRow.prop, tile: reducedTile.prop, hand: reducedHand.prop }));

    await page.media([]);
    await showScene(page, "turn");
    await page.shot("surface-turn");
    const demoErrors = page.errorsFor();
    check(demoErrors.length === 0, "the motion harness logs no console error", JSON.stringify(demoErrors.slice(0, 3)));

    await finePointerPass();

    console.log("");
    console.log("== 5. the skin harness page ==");
    await page.goto(BASE + "/dev/citadels-interface");
    const boardReady = await page.waitFor("document.querySelector('[data-slot=citadels-surface]')");
    check(boardReady, "the interface harness renders the surface root");
    const board = await page.eval("(() => { const root = document.querySelector('[data-slot=citadels-surface]'); const all = [root, ...root.querySelectorAll('*')]; const rounded = all.filter((el) => !(el instanceof HTMLImageElement) && parseFloat(getComputedStyle(el).borderTopLeftRadius) > 0); const inner = document.querySelector('[data-slot=citadels-board]'); return { elements: all.length, rounded: rounded.length, cast: document.querySelectorAll('[data-slot=citadels-cast-row]').length, seats: document.querySelectorAll('[data-slot=citadels-seat]').length, hand: document.querySelectorAll('[data-slot=citadels-hand] [data-slot=citadels-district]').length, bar: document.querySelectorAll('[data-slot=citadels-action]').length, pad: getComputedStyle(root).padding, boardPad: getComputedStyle(inner).padding }; })()");
    console.log("   interface page: " + JSON.stringify(board));
    check(board.rounded === 0, "no element on the harness surface carries a corner radius", String(board.rounded));
    check(board.cast === 8 && board.seats === 4 && board.hand > 0 && board.bar > 0, "the converted page still draws the cast, the seats, the hand and the turn bar", JSON.stringify(board));
    await page.shot("interface-surface");
    const boardErrors = page.errorsFor();
    check(boardErrors.length === 0, "the skin harness logs no console error", JSON.stringify(boardErrors.slice(0, 3)));
  } finally {
    browser.close();
  }
  console.log(failures === 0 ? "ALL CHECKS PASS" : failures + " CHECK(S) FAILED");
  process.exitCode = failures === 0 ? 0 : 1;
};

await main();
