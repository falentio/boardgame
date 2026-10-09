// The host and port must match BETTER_AUTH_URL in .dev.vars, or better-auth rejects the sign-up with INVALID_ORIGIN.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const PORT = Number(argOf('--port', '3100'));
const BASE = 'http://localhost:' + PORT;
const ROOT = new URL('..', import.meta.url).pathname;
const OUT = argOf('--out', new URL('../.audit/motion/', import.meta.url).pathname);
const STAMP = Date.now();
const PASSWORD = 'proof-password-123';
// Runs at document-start so the picker's first frames are captured even when
// hydration and the readiness poll finish after the 220ms enter.
const PICKER_SAMPLER = "(function () { window.__pickerSamples = []; var sel = '[data-slot=window-picker]'; var start = performance.now(); function tick() { var el = document.querySelector(sel); if (el) { var cs = getComputedStyle(el); window.__pickerSamples.push({ t: Math.round(performance.now() - start), opacity: Number(cs.opacity), transform: cs.transform }); if (window.__pickerSamples.length < 90) requestAnimationFrame(tick); return; } if (performance.now() - start < 30000) requestAnimationFrame(tick); } requestAnimationFrame(tick); })();";

mkdirSync(OUT, { recursive: true });

const failures = [];
const fail = (msg) => { failures.push(msg); console.error('FAIL: ' + msg); };
const pass = (msg) => console.log('PASS: ' + msg);
const info = (msg) => console.log('INFO: ' + msg);

const serverAnswers = async () => {
  try { return (await fetch(BASE + '/api/auth/ok')).ok; } catch { return false; }
};
const startServer = async () => {
  if (await serverAnswers()) return { server: null };
  const server = spawn('pnpm', ['exec', 'nuxt', 'dev', '--port', String(PORT), '--host', 'localhost'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_ENV: 'development' },
  });
  let log = '';
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
  for (let i = 0; i < 180; i++) { if (await serverAnswers()) return { server }; await delay(1000); }
  throw new Error('dev server never became ready:\n' + log);
};

const signUp = async (label) => {
  const email = 'motion-' + label + '-' + STAMP + '@example.com';
  const res = await fetch(BASE + '/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ email, password: PASSWORD, name: label }),
  });
  if (res.status !== 200) throw new Error('sign-up ' + label + ' returned ' + res.status + ': ' + (await res.text()));
  const body = await res.json();
  const cookie = res.headers.get('set-cookie');
  const pair = cookie.split(';')[0];
  const eq = pair.indexOf('=');
  return { id: body.user.id, name: label, cookieName: pair.slice(0, eq), cookieValue: pair.slice(eq + 1) };
};

const launchBrowser = async (label, debugPort) => {
  const profileDir = '/tmp/proof-motion-' + label + '-' + PORT + '-' + process.pid;
  rmSync(profileDir, { recursive: true, force: true });
  const chrome = spawn('/usr/bin/google-chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--user-data-dir=' + profileDir, '--remote-debugging-port=' + debugPort,
    '--remote-allow-origins=*', 'about:blank',
  ], { stdio: 'ignore' });
  let wsUrl = null;
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch('http://127.0.0.1:' + debugPort + '/json/version'); if (r.ok) { wsUrl = (await r.json()).webSocketDebuggerUrl; break; } } catch {}
    await delay(250);
  }
  if (!wsUrl) throw new Error(label + ': chrome never exposed a debug endpoint');
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method && listeners.has(m.method)) for (const fn of listeners.get(m.method)) fn(m.params);
  };
  const send = (method, params = {}, sessionId) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
  const on = (method, fn) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(fn); };
  const created = (await send('Target.createTarget', { url: 'about:blank' })).result;
  const attached = (await send('Target.attachToTarget', { targetId: created.targetId, flatten: true })).result;
  const session = attached.sessionId;
  await send('Page.enable', {}, session);
  await send('Runtime.enable', {}, session);
  await send('Network.enable', {}, session);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: PICKER_SAMPLER }, session);
  const page = {
    async setViewport(width, height) { await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }, session); await delay(200); },
    async setSessionCookie(user) { await send('Network.setCookie', { url: BASE, name: user.cookieName, value: user.cookieValue }, session); },
    async emulateReducedMotion(reduce) { await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }] }, session); },
    async goto(url, opts) {
      const waitMs = (opts && opts.waitMs) || 1500;
      const loaded = new Promise((res) => { on('Page.loadEventFired', () => res()); setTimeout(res, 15000); });
      await send('Page.navigate', { url }, session); await loaded; await delay(waitMs);
    },
    async eval(expression) {
      const msg = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, session);
      if (msg.result && msg.result.exceptionDetails) throw new Error('eval failed: ' + msg.result.exceptionDetails.text);
      return msg.result.result.value;
    },
    async url() { return page.eval('location.pathname'); },
    async waitFor(expression, opts) {
      const timeoutMs = (opts && opts.timeoutMs) || 8000;
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) { if (await page.eval('!!(' + expression + ')')) return true; await delay(150); }
      return false;
    },
    async waitForHydration(opts) {
      const timeoutMs = (opts && opts.timeoutMs) || 30000;
      const ok = await page.waitFor("document.querySelector('#__nuxt') && document.querySelector('#__nuxt').__vue_app__", { timeoutMs });
      if (!ok) throw new Error('Vue never hydrated');
    },
    async rectOf(jsEl) { return page.eval("(() => { const el = " + jsEl + "; if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, disabled: !!el.disabled }; })()"); },
    async mouseClick(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 }, session);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 }, session);
      await delay(40);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 }, session);
    },
    async clickReal(jsEl, opts) {
      const attempts = (opts && opts.attempts) || 6;
      const settleMs = (opts && opts.settleMs) || 300;
      for (let i = 0; i < attempts; i++) {
        const rect = await page.rectOf(jsEl);
        if (rect === null) { await delay(250); continue; }
        if (rect.disabled) { await delay(250); continue; }
        await delay(60);
        await page.mouseClick(rect.x, rect.y);
        await delay(settleMs);
        return true;
      }
      return false;
    },
    async screenshot(name) { const result = (await send('Page.captureScreenshot', { format: 'png' }, session)).result; const p = OUT + name + '.png'; writeFileSync(p, Buffer.from(result.data, 'base64')); return p; },
  };
  return { chrome, page, close: () => chrome.kill('SIGKILL') };
};

const EL = {
  picker: '[data-slot=window-picker]',
  generalCard: (name) => "[...document.querySelectorAll('[data-slot=window-picker] button[data-slot=general-action-card]')].find((b) => (b.getAttribute('aria-label') || '').startsWith(" + JSON.stringify(name) + '))',
  confirm: "[...document.querySelectorAll('[data-slot=window-picker] button')].find((b) => b.textContent.trim() === 'Confirm')",
  buttonText: (name) => "[...document.querySelectorAll('button')].find((b) => b.textContent.trim().includes(" + JSON.stringify(name) + '))',
  seats: "document.querySelector('#seats')",
  seatsOption: "[...document.querySelectorAll('[role=option]')].find((o) => o.textContent.trim() === '2')",
};

const isOffset = (transform) => typeof transform === 'string' && transform !== 'none' && /matrix\(1, 0, 0, 1, 0, [1-9]/.test(transform);

const main = async () => {
  const started = await startServer();
  const server = started.server;
  try {
    const host = await signUp('host');
    const guest = await signUp('guest');
    pass('created accounts ' + host.name + ' and ' + guest.name);
    const hostBrowser = await launchBrowser('host', PORT + 51);
    const guestBrowser = await launchBrowser('guest', PORT + 52);
    try {
      await hostBrowser.page.setViewport(1280, 1000);
      await guestBrowser.page.setViewport(1280, 1000);
      await hostBrowser.page.setSessionCookie(host);
      await guestBrowser.page.setSessionCookie(guest);

      await hostBrowser.page.goto(BASE + '/rooms/new');
      await hostBrowser.page.waitForHydration();
      const easeOut = await hostBrowser.page.eval("getComputedStyle(document.documentElement).getPropertyValue('--ease-out').trim()");
      info('--ease-out resolves to ' + JSON.stringify(easeOut));
      if (easeOut !== 'cubic-bezier(0.23, 1, 0.32, 1)') fail('--ease-out is ' + JSON.stringify(easeOut));
      else pass('--ease-out resolves to cubic-bezier(0.23, 1, 0.32, 1)');
      const easeInOut = await hostBrowser.page.eval("getComputedStyle(document.documentElement).getPropertyValue('--ease-in-out').trim()");
      if (easeInOut !== 'cubic-bezier(0.77, 0, 0.175, 1)') fail('--ease-in-out is ' + JSON.stringify(easeInOut));
      else pass('--ease-in-out resolves to cubic-bezier(0.77, 0, 0.175, 1)');

      await hostBrowser.page.clickReal(EL.seats);
      const opened = await hostBrowser.page.waitFor("document.querySelectorAll('[role=option]').length >= 7", { timeoutMs: 4000 });
      if (!opened) throw new Error('the seats select did not open');
      await hostBrowser.page.clickReal(EL.seatsOption);
      await hostBrowser.page.clickReal(EL.buttonText('Create room'));
      const inLobby = await hostBrowser.page.waitFor('/^\\/rooms\\/[A-Z]{8,9}$/.test(location.pathname)', { timeoutMs: 20000 });
      if (!inLobby) throw new Error('create did not land in the lobby, at ' + (await hostBrowser.page.url()));
      const code = (await hostBrowser.page.url()).replace('/rooms/', '');
      await guestBrowser.page.goto(BASE + '/join/' + code);
      await guestBrowser.page.waitFor('/^\\/rooms\\/[A-Z]{8,9}$/.test(location.pathname)', { timeoutMs: 20000 });
      let full = await hostBrowser.page.waitFor("document.body.innerText.includes('All seats filled')", { timeoutMs: 15000 });
      if (!full) { await hostBrowser.page.goto(BASE + '/rooms/' + code); full = await hostBrowser.page.waitFor("document.body.innerText.includes('All seats filled')", { timeoutMs: 15000 }); }
      if (!full) throw new Error('room ' + code + ' never became full');
      await hostBrowser.page.clickReal(EL.buttonText('Start game'));
      await hostBrowser.page.waitFor('/^\\/games\\/[A-Z]{8,9}$/.test(location.pathname)', { timeoutMs: 15000 });
      await guestBrowser.page.goto(BASE + '/games/' + code);
      await hostBrowser.page.waitForHydration();
      await guestBrowser.page.waitForHydration();
      await hostBrowser.page.waitFor("document.querySelector('" + EL.picker + "')", { timeoutMs: 20000 });
      pass('host is in the turn window on the live board');

      const declared = await hostBrowser.page.eval("(() => { const el = document.querySelector('" + EL.picker + "'); const cs = getComputedStyle(el); return { property: cs.transitionProperty, duration: cs.transitionDuration, timing: cs.transitionTimingFunction }; })()");
      info('picker transition: ' + JSON.stringify(declared));
      if (!declared.property.includes('opacity') || !declared.property.includes('transform')) fail('picker transitionProperty is ' + declared.property);
      else pass('picker transitions opacity and transform');
      if (!declared.timing.includes('0.23, 1, 0.32, 1')) fail('picker timing is ' + declared.timing);
      else pass('picker uses the strong ease-out curve');

      await hostBrowser.page.clickReal(EL.generalCard('Income'));
      await hostBrowser.page.clickReal(EL.confirm);
      await hostBrowser.page.waitFor("!document.querySelector('" + EL.picker + "')", { timeoutMs: 12000 });
      await guestBrowser.page.goto(BASE + '/games/' + code);
      await guestBrowser.page.waitForHydration();
      const enterReady = await guestBrowser.page.waitFor("document.querySelector('" + EL.picker + "')", { timeoutMs: 20000 });
      if (!enterReady) fail('guest picker never appeared for the enter sample');
      else {
        await guestBrowser.page.waitFor("(() => { const s = window.__pickerSamples; return s && s.length && s[s.length - 1].opacity >= 0.99; })()", { timeoutMs: 4000 });
        const samples = await guestBrowser.page.eval('window.__pickerSamples || []');
        const first = samples && samples[0];
        const last = samples && samples[samples.length - 1];
        const minOpacity = samples && samples.length ? Math.min(...samples.map((x) => x.opacity)) : 1;
        info('picker enter: first=' + JSON.stringify(first) + ' last=' + JSON.stringify(last) + ' frames=' + (samples ? samples.length : 0));
        if (!samples || samples.length < 3) fail('the document-start sampler captured too few frames: ' + (samples ? samples.length : 0));
        else if (minOpacity > 0.9) fail('picker never entered from low opacity: min ' + minOpacity);
        else pass('picker entered from opacity ' + minOpacity);
        if (!last || last.opacity < 0.95) fail('picker did not settle at full opacity: ' + (last && last.opacity));
        else pass('picker settled at opacity ' + last.opacity);
        const sawOffset = samples && samples.some((s) => isOffset(s.transform));
        if (!sawOffset) fail('picker never showed a translateY offset: ' + JSON.stringify(samples && samples.map((s) => s.transform)));
        else pass('picker entered with a translateY offset');
        await guestBrowser.page.screenshot('motion-01-picker-enter');
      }

      await guestBrowser.page.emulateReducedMotion(true);
      await guestBrowser.page.goto(BASE + '/games/' + code);
      await guestBrowser.page.waitForHydration();
      const rmReady = await guestBrowser.page.waitFor("document.querySelector('" + EL.picker + "')", { timeoutMs: 20000 });
      if (!rmReady) fail('guest picker never appeared under reduced motion');
      else {
        await guestBrowser.page.waitFor("(() => { const s = window.__pickerSamples; return s && s.length && s[s.length - 1].opacity >= 0.99; })()", { timeoutMs: 4000 });
        const rm = await guestBrowser.page.eval('window.__pickerSamples || []');
        const anyOffset = rm && rm.some((s) => isOffset(s.transform));
        const rmDeclared = await guestBrowser.page.eval("(() => { const cs = getComputedStyle(document.querySelector('" + EL.picker + "')); return cs.transitionProperty; })()");
        info('reduced-motion: transitionProperty=' + rmDeclared + ' transforms=' + JSON.stringify(rm && rm.map((s) => s.transform)));
        if (anyOffset) fail('reduced motion still moved the picker');
        else pass('reduced motion drops the picker translateY');
        if (!rmDeclared.includes('opacity')) fail('reduced motion dropped the opacity transition: ' + rmDeclared);
        else pass('reduced motion keeps the opacity transition');
        await guestBrowser.page.screenshot('motion-02-picker-reduced-motion');
      }
      await guestBrowser.page.emulateReducedMotion(false);

      const pageCss = await hostBrowser.page.eval("(() => { const rules = []; for (const sheet of document.styleSheets) { try { for (const r of sheet.cssRules) rules.push(r.cssText); } catch (e) {} } return rules.join('\\n'); })()");
      if (!(/\.status-enter-active/.test(pageCss) && /\.status-enter-from/.test(pageCss))) fail('status swap classes missing from the sheet');
      else pass('the status swap declares .status-enter-active/.status-enter-from');
      const bannerRule = pageCss.split('\n').find((r) => r.includes('winner-banner') && r.includes('transition:'));
      if (!bannerRule) fail('winner banner declares no transition');
      else pass('the winner banner declares its transition');
      if (!(/@starting-style/.test(pageCss) && /winner-banner/.test(pageCss))) fail('winner banner has no @starting-style enter');
      else pass('the winner banner declares an @starting-style enter');

      const seatDeclared = await hostBrowser.page.eval("(() => { const el = document.querySelector('[data-slot=game-board] .size-11'); if (!el) return null; const cs = getComputedStyle(el); return { property: cs.transitionProperty, duration: cs.transitionDuration }; })()");
      info('avatar transition: ' + JSON.stringify(seatDeclared));
      if (!seatDeclared || !seatDeclared.property.includes('box-shadow')) fail('avatar has no box-shadow transition: ' + JSON.stringify(seatDeclared));
      else pass('avatar ring transitions box-shadow over ' + seatDeclared.duration);

      const resignDeclared = await hostBrowser.page.eval("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Resign'); if (!b) return null; const cs = getComputedStyle(b); return { property: cs.transitionProperty, duration: cs.transitionDuration }; })()");
      info('resign transition: ' + JSON.stringify(resignDeclared));
      if (!resignDeclared || !resignDeclared.property.includes('transform')) fail('resign has no transform transition: ' + JSON.stringify(resignDeclared));
      else pass('Resign transitions transform for press feedback');

      await hostBrowser.page.screenshot('motion-03-host-turn');
    } finally {
      hostBrowser.close();
      guestBrowser.close();
    }
    if (failures.length > 0) { console.error('\n' + failures.length + ' check(s) failed'); process.exitCode = 1; }
    else console.log('\nall motion proof checks passed');
  } finally {
    if (server) server.kill('SIGKILL');
  }
};

await main();
