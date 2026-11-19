/* packing-list-bd headless-Chrome smoke test (raw CDP, no deps).
 * Run: node tests/smoke.mjs  (from the packing-list-bd folder)
 * Loads index.html over file://, drives the real UI, collects
 * console/page errors, asserts visible state at 1440px and 390px. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const PAGE_URL = 'file:///home/hatch/workspace/muse-project-factory/builds/packing-list-bd/index.html';
const PORT = 9231;

let pass = 0, fail = 0;
const errors = [];
const netReqs = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra ? ' \u2014 ' + extra : '')); }
}

const chrome = spawn(SHELL, ['--headless', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${PORT}`, 'about:blank'], { stdio: 'ignore' });

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('headless_shell did not start');
}

let msgId = 0;
const pending = new Map();
let ws;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
}
async function click(selector) {
  await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) throw new Error('missing ' + ${JSON.stringify(selector)}); e.click(); return true; })()`);
}
async function setVal(selector, value) {
  await evalJs(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); e.value = ${JSON.stringify(value)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
}
async function submitForm(selector) {
  await evalJs(`(() => { document.querySelector(${JSON.stringify(selector)}).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); return true; })()`);
}

try {
  const wsUrl = await getWsUrl();
  ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('CONSOLE.ERROR: ' + JSON.stringify(m.params.args).slice(0, 300));
    if (m.method === 'Network.requestWillBeSent') netReqs.push(m.params.request.url);
  };
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1500);
  await evalJs(`localStorage.clear()`);
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1200);

  /* ---- initial render ---- */
  check('title renders', await evalJs(`document.querySelector('#appTitle').textContent`) === 'Packing List BD');
  check('3 tabs present', await evalJs(`document.querySelectorAll('.tab').length`) === 3);
  check('empty state shown', await evalJs(`!document.querySelector('#noTrips').hidden`));
  check('5 trip types in select', await evalJs(`document.querySelectorAll('#fType option').length`) === 5);

  /* ---- validation: empty submit shows inline errors ---- */
  await submitForm('#tripForm');
  await sleep(300);
  check('empty name error shown', await evalJs(`document.querySelector('#eName').textContent.length > 0`));
  check('no trip created on invalid submit', await evalJs(`document.querySelectorAll('.trip-card').length`) === 0);

  /* ---- create a beach trip, 5 days ---- */
  await setVal('#fName', 'Cox family trip');
  await setVal('#fDest', "Cox's Bazar");
  await setVal('#fType', 'beach');
  await setVal('#fStart', '2026-12-20');
  await setVal('#fEnd', '2026-12-24');
  await submitForm('#tripForm');
  await sleep(400);
  check('switched to pack tab', await evalJs(`document.querySelector('#tab-pack').classList.contains('active')`));
  check('trip name in pack header', await evalJs(`document.querySelector('#packTripName').textContent`) === 'Cox family trip');
  check('beach 5-day list has 24 items', await evalJs(`document.querySelectorAll('.item-row').length`) === 24);
  check('t-shirt qty scaled to 5', await evalJs(`[...document.querySelectorAll('.item-row')].find(r => r.textContent.includes('T-shirt')).textContent.includes('\u00d7 5')`));
  check('progress starts 0 / 24', await evalJs(`document.querySelector('#progressText').textContent`) === '0 / 24 packed (0%)');
  check('6 category groups', await evalJs(`document.querySelectorAll('.cat-group').length`) === 6);

  /* ---- check 3 items -> progress 3/24 = 13% (rounded) ---- */
  await evalJs(`[...document.querySelectorAll('.item-row input[type=checkbox]')].slice(0, 3).forEach(cb => cb.click())`);
  await sleep(300);
  check('progress after 3 checks', await evalJs(`document.querySelector('#progressText').textContent`) === '3 / 24 packed (13%)');

  /* ---- qty stepper: + on first item ---- */
  const qBefore = await evalJs(`document.querySelector('.item-row .qty-val').textContent`);
  await evalJs(`document.querySelector('.item-row .qty-btn:last-child').click()`);
  await sleep(300);
  const qAfter = await evalJs(`document.querySelector('.item-row .qty-val').textContent`);
  check('qty stepper increments', qBefore === '\u00d7 1' && qAfter === '\u00d7 2', qBefore + ' -> ' + qAfter);

  /* ---- add a custom item ---- */
  await setVal('#cName', 'Sunglasses case');
  await setVal('#cCat', 'money');
  await setVal('#cQty', '2');
  await submitForm('#customForm');
  await sleep(300);
  check('custom item added (25 rows)', await evalJs(`document.querySelectorAll('.item-row').length`) === 25);
  check('custom item visible', await evalJs(`[...document.querySelectorAll('.item-name')].some(e => e.textContent === 'Sunglasses case')`));

  /* ---- reload persistence ---- */
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1200);
  check('trip persists after reload', await evalJs(`document.querySelectorAll('.trip-card').length`) === 1);
  check('checked count persists', await evalJs(`document.querySelector('#progressText').textContent`) === '3 / 25 packed (12%)');
  check('custom item persists', await evalJs(`[...document.querySelectorAll('.item-name')].some(e => e.textContent === 'Sunglasses case')`));

  /* ---- duplicate + delete on Trips tab ---- */
  await click('.tab[data-tab="trips"]');
  await sleep(300);
  await evalJs(`[...document.querySelectorAll('.trip-card .btn')].find(b => b.textContent === 'Duplicate').click()`);
  await sleep(300);
  check('duplicate makes 2 trips', await evalJs(`document.querySelectorAll('.trip-card').length`) === 2);
  await evalJs(`window.confirm = () => true; [...document.querySelectorAll('.trip-card')][1].querySelectorAll('.btn')[2].click()`);
  await sleep(300);
  check('delete removes duplicate', await evalJs(`document.querySelectorAll('.trip-card').length`) === 1);

  /* ---- XSS: script-tag item name rendered as text, not executed ---- */
  await click('.tab[data-tab="pack"]');
  await sleep(300);
  await setVal('#cName', '<script>alert(1)</script>');
  await submitForm('#customForm');
  await sleep(300);
  check('script-tag name rendered as text', await evalJs(`[...document.querySelectorAll('.item-name')].some(e => e.textContent === '<script>alert(1)</script>')`));
  check('no script element injected', await evalJs(`document.querySelectorAll('.item-list script').length`) === 0);

  /* ---- Bengali toggle ---- */
  await click('#langBtn');
  await sleep(400);
  check('BN title renders', await evalJs(`document.querySelector('#appTitle').textContent`) === '\u09aa\u09cd\u09af\u09be\u0995\u09bf\u0982 \u09b2\u09bf\u09b8\u09cd\u099f \u09ac\u09bf\u09a1\u09bf');
  check('BN progress digits', await evalJs(`document.querySelector('#progressText').textContent.includes('\u09e9')`));
  check('BN category heading', await evalJs(`[...document.querySelectorAll('.cat-group h3')].some(h => h.textContent.includes('\u0995\u09be\u0997\u099c\u09aa\u09a4\u09cd\u09b0'))`));
  await click('#langBtn');
  await sleep(300);

  /* ---- export/import round-trip via UI ---- */
  await click('.tab[data-tab="data"]');
  await sleep(300);
  const exported = await evalJs(`PLBD_LOGIC.serialize(JSON.parse(localStorage.getItem('packing-list-bd-v1')))`);
  await setVal('#importBox', exported);
  await click('#importBtn');
  await sleep(300);
  check('import ok message', await evalJs(`document.querySelector('#importMsg').textContent`) === 'Backup imported.');
  await setVal('#importBox', '{"app":"nope"}');
  await click('#importBtn');
  await sleep(300);
  check('bad import rejected with message', await evalJs(`document.querySelector('#importMsg').textContent.length > 0`));
  check('data intact after bad import', await evalJs(`document.querySelectorAll('.trip-card').length`) === 1);

  /* ---- 390px mobile: no horizontal overflow ---- */
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: PAGE_URL });
  await sleep(1200);
  await click('.tab[data-tab="pack"]');
  await sleep(400);
  check('390px no horizontal overflow (pack)', await evalJs(`document.documentElement.scrollWidth <= 391`), 'scrollWidth=' + await evalJs(`document.documentElement.scrollWidth`));
  await click('.tab[data-tab="trips"]');
  await sleep(300);
  check('390px no horizontal overflow (trips)', await evalJs(`document.documentElement.scrollWidth <= 391`));

  /* ---- error / network audit ---- */
  check('zero console/page errors', errors.length === 0, errors.join(' | ').slice(0, 500));
  const external = netReqs.filter((u) => !u.startsWith('file://') && !u.startsWith('data:'));
  check('zero external network requests', external.length === 0, external.join(', ').slice(0, 300));
} catch (e) {
  fail++;
  console.log('FAIL harness error \u2014 ' + (e && e.message ? e.message : e));
} finally {
  try { await send('Page.close'); } catch { /* ignore */ }
  chrome.kill();
}

console.log(`\nSMOKE: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
