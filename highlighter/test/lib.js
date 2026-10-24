// Test harness: loads the built userscript (or the file at HL_SCRIPT) into headless Chromium
// pages served at https://example.test/, with an in-memory GM_* storage, and exposes the
// script's state as window.__hl. Used by every *.test.js here; run them all with `node run.js`.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const SCRIPT = process.env.HL_SCRIPT || path.resolve(__dirname, '../Highlighter.user.js');
const BOOT = '    if (siteEnabled()) start();';
function instrument(src) {
  if (!src.includes(BOOT)) throw new Error('boot anchor missing');
  const names = ['panelEl', 'panelList', 'panelFilter', 'panelCount', 'panelCopy', 'panelErase', 'panelSelectAll', 'toastEl', 'toastText', 'toastAction', 'noteCardEl', 'cardHint', 'cardText', 'cardPin',
    'editorEl', 'noteInput', 'uiRoot', 'uiHost', 'undoStack', 'redoStack', 'toolbarEl', 'labelTipEl', 'lateWatcher', 'currentKey', 'menuIds', 'running', 'darkMode', 'hoveredWrapper', 'annotationsHidden', 'cardWrapper', 'penEl', 'penKey', 'lastStyleKey', 'everythingEl', 'everythingFilter', 'everythingList', 'everythingCount', 'everythingSelectAll', 'everythingCopy', 'everythingForget', 'everythingClose', 'selectBoxesEl', 'selectedGroups', 'shownWrappers', 'menuEl', 'menuMaster', 'menuButtons', 'menuClose'];
  const get = n => `get ${n}() { try { return ${n}; } catch (e) { return undefined; } }`;
  return src.replace(BOOT, `    window.__hl = { ${names.map(get).join(', ')}, get editor() { return editor; }, get pending() { return pendingRecords; }, get jumpGroup() { return jumpGroup; },
      showToast, allWrappers, getSvg, openPanel, closePanel, copyAnnotations, renderPanel, pageAnnotations, groupTime, getCurrentRecords, saveEditor: () => saveEditor(),
      ${['pageCounts', 'missingRecords', 'isOtherPage', 'pageTag', 'looseLocate', 'noticedKeys'].map(get).join(', ')}, get panelScroll() { return panelList.scrollTop; } };\n` + BOOT);
}
const GM = `
function GM_getValue(k, d) { return Object.prototype.hasOwnProperty.call(window.__gm, k) ? window.__gm[k] : d; }
// Value-change listeners as Violentmonkey calls them: this tab's own changes (remote false), and
// another tab's (window.__deliver with remote true; see open's onSend for linking two pages).
window.__ls = window.__ls || []; let __lsId = 0;
function GM_addValueChangeListener(k, fn) { const id = ++__lsId; window.__ls.push({ id, k, fn }); return id; }
function GM_removeValueChangeListener(id) { window.__ls = window.__ls.filter(l => l.id !== id); }
window.__deliver = (k, o, v, remote) => { if (remote) { if (v === undefined) delete window.__gm[k]; else window.__gm[k] = v; } window.__ls.filter(l => l.k === k).forEach(l => l.fn(k, o, v, remote)); };
function __change(k, v) { const o = window.__gm[k]; if (v === undefined) delete window.__gm[k]; else window.__gm[k] = v; if (o === v) return; window.__deliver(k, o, v, false); if (window.__send) window.__send(k, o === undefined ? null : o, v === undefined ? null : v); }
function GM_setValue(k, v) { __change(k, v); }
function GM_deleteValue(k) { __change(k, undefined); }
function GM_listValues() { return Object.keys(window.__gm); }
function GM_registerMenuCommand(l, fn) { (window.__menu = window.__menu || {})[l] = fn; window.__menuLog = (window.__menuLog || 0) + 1; return l; }
function GM_unregisterMenuCommand(id) { if (window.__menu) delete window.__menu[id]; }
function GM_setClipboard(t) { window.__clip = t; }
`;
const SRC = GM + instrument(fs.readFileSync(SCRIPT, 'utf8'));
// onSend(page, key, old, value): called for each storage change the page makes (see live-sync.test.js).
// headers: response headers for the page (see fixes-8.0.test.js).
async function open(browser, opts) {
  const { html, store = {}, scheme = 'light', url = 'https://example.test/a', viewport = { width: 1100, height: 700 }, wait = 800, routes = null, hidden = null } = opts;
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: realDsf ? null : viewport, deviceScaleFactor: realDsf ? undefined : +(process.env.DSF || 1) });
  const page = await ctx.newPage();
  // HL_CPU=6 runs the page's CPU 6x slower, to find checks that only pass on a fast machine.
  if (+process.env.HL_CPU > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: +process.env.HL_CPU });
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push('PAGEERR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') page.__errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('dialog', d => { page.__errors.push('DIALOG ' + d.message()); d.accept(); });
  await page.route('https://example.test/**', r => r.fulfill({ status: 200, contentType: 'text/html', headers: opts.headers || {}, body: (routes && routes[new URL(r.request().url()).pathname + new URL(r.request().url()).search]) || html }));
  // Sites are off until switched on: the pages under test start switched on, unless the test sets its own sites.
  const seeded = Object.assign({}, store);
  let cfg = {}; try { cfg = JSON.parse(seeded['rnh:settings'] || '{}'); } catch (e) { /* kept as is */ }
  if (!opts.siteOff && !('enabledSites' in cfg)) seeded['rnh:settings'] = JSON.stringify(Object.assign(cfg, { enabledSites: [new URL(url).hostname], sitesMigrated: true }));
  // The sticky menu sits top left over the pages' text: hidden here unless the test is about it (opts.menu).
  if (!opts.menu && !/menuHiddenSites/.test(seeded['rnh:settings'] || '')) seeded['rnh:settings'] = JSON.stringify(Object.assign(JSON.parse(seeded['rnh:settings'] || '{}'), { menuHiddenSites: [new URL(url).hostname] }));
  await page.addInitScript(s => { window.__gm = JSON.parse(s); }, JSON.stringify(seeded));
  if (opts.onSend) await page.exposeFunction('__send', (k, o, v) => opts.onSend(page, k, o, v));
  if (hidden !== null) await page.addInitScript(h => {
    window.__hidden = h;
    Object.defineProperty(Document.prototype, 'hidden', { get: () => window.__hidden, configurable: true });
    Object.defineProperty(Document.prototype, 'visibilityState', { get: () => window.__hidden ? 'hidden' : 'visible', configurable: true });
  }, hidden);
  await page.goto(url);
  // A page whose headers forbid setting a script's text (Trusted Types) still runs the script,
  // as a userscript manager would.
  if (opts.headers) await page.evaluate(`0;${SRC}`); else await page.addScriptTag({ content: SRC });
  await page.waitForTimeout(wait);
  // On a slow machine the stored annotations can take longer than `wait` to come back.
  if (/^\[\s*\{/.test(store[url])) await until(page, () => window.__hl && window.__hl.allWrappers().length, null, 3000);
  return { ctx, page };
}
// Selects [str] (or from the first occurrence of str to the end of endStr) inside the element; backward = focus at the start.
async function selStr(page, sel, str, { endStr = null, backward = false, nth = 0 } = {}) {
  return page.evaluate(([sel, str, endStr, backward, nth]) => {
    const el = document.querySelector(sel);
    const text = el.textContent; let a = -1; for (let i = 0; i <= nth; i++) a = text.indexOf(str, a + 1); if (a < 0) throw new Error('not found ' + str);
    const b = endStr ? text.indexOf(endStr, a) + endStr.length : a + str.length;
    const pt = (off, end) => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, acc = 0;
      while ((n = w.nextNode())) { if (end ? acc + n.nodeValue.length >= off : acc + n.nodeValue.length > off) return [n, off - acc]; acc += n.nodeValue.length; } };
    const s = getSelection(); s.removeAllRanges();
    const [sn, so] = pt(a, false), [en, eo] = pt(b, true);
    if (backward) s.setBaseAndExtent(en, eo, sn, so); else s.setBaseAndExtent(sn, so, en, eo);
    return s.toString();
  }, [sel, str, endStr, backward, nth]);
}
async function altKey(page, key, shift) {
  await page.keyboard.down('Alt'); if (shift) await page.keyboard.down('Shift');
  await page.keyboard.press(key);
  if (shift) await page.keyboard.up('Shift'); await page.keyboard.up('Alt');
  await page.waitForTimeout(150);
}
const toast = page => page.evaluate(() => { const r = window.__hl; return r.toastEl.hidden ? null : r.toastText.textContent + (r.toastAction.hidden ? '' : ' · ' + r.toastAction.dataset.action); });
const wr = page => page.evaluate(() => window.__hl.allWrappers().map(w => {
  const o = { k: w.getAttribute('data-style-key'), t: w.textContent, g: w.getAttribute('data-highlighter-group') };
  const n = w.getAttribute('data-highlighter-note'); if (n) o.n = n; return o; }));
const stored = (page, key = 'https://example.test/a') => page.evaluate(k => JSON.parse(window.__gm[k] || '[]'), key);
const toolbar = page => page.evaluate(() => { const t = window.__hl.toolbarEl; if (t.hidden) return null; const r = t.getBoundingClientRect();
  return { rect: { top: r.top, left: r.left, bottom: r.bottom, right: r.right, width: r.width, height: r.height },
    buttons: Array.from(t.querySelectorAll('button')).map(b => ({ label: b.dataset.label, pressed: b.getAttribute('aria-pressed'), bg: getComputedStyle(b).backgroundColor })) }; });
let fails = 0;
function check(name, ok, info) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + JSON.stringify(info)}`); if (!ok) fails++; }
// launch(dsf) starts the browser itself at that device scale factor, so layout and painting snap to real device
// pixels; a context's deviceScaleFactor is only emulated and snaps to CSS pixels (dividers then paint 2 or 3 columns by phase).
let realDsf = 0;
const launch = (dsf = 0) => { realDsf = dsf; return chromium.launch(dsf ? { args: ['--force-device-scale-factor=' + dsf] } : {}); };
const setHidden = (page, h) => page.evaluate(h => { window.__hidden = h; document.dispatchEvent(new Event('visibilitychange')); }, h);
const menu = page => page.evaluate(() => Object.keys(window.__menu || {}));
// The panel's rows: annotations ({ g, missing, text, note, meta }) and section titles ({ label }).
const items = page => page.evaluate(() => Array.from(window.__hl.panelList.children).map(el => el.dataset.group ? { g: el.dataset.group, missing: el.classList.contains('missing'), text: el.querySelector('.item-text').textContent, note: (el.querySelector('.item-note') || {}).textContent, meta: el.querySelector('.item-meta').textContent } : { label: el.textContent }));
// Closes the browser and exits with the number of failed checks (see run.js).
async function done(browser) { await browser.close(); console.log(fails ? `FAILS ${fails}` : 'ALL PASS'); process.exit(fails ? 1 : 0); }
// Waits until fn(arg) is true in the page (false after `timeout` ms), for checks on work the script does later.
const until = (page, fn, arg, timeout = 5000) => page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => true, () => false);
// Waits until the page has stopped scrolling (scroll position unchanged for 250 ms), e.g. after a smooth scroll.
const scrolled = page => until(page, () => { const y = scrollY, now = performance.now();
  if (window.__scrollY !== y) { window.__scrollY = y; window.__scrollAt = now; } return now - window.__scrollAt >= 250; });
module.exports = { until, scrolled, items, done, setHidden, menu, launch, open, selStr, altKey, toast, wr, stored, toolbar, check, get fails() { return fails; } };
// 7.32: the viewport rectangles of `str` inside `sel` (one per line), for real mouse input.
module.exports.rects = (page, sel, str) => page.evaluate(([sel, str]) => {
  const el = document.querySelector(sel); const a = el.textContent.indexOf(str);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n, acc = 0, start, end;
  while ((n = w.nextNode())) { const L = n.nodeValue.length;
    if (!start && acc + L > a) start = [n, a - acc];
    if (!end && acc + L >= a + str.length) end = [n, a + str.length - acc];
    acc += L; }
  const r = document.createRange(); r.setStart(...start); r.setEnd(...end);
  return Array.from(r.getClientRects()).filter(x => x.width).map(x => ({ left: x.left, right: x.right, top: x.top, bottom: x.bottom }));
}, [sel, str]);
// Drags the mouse across `str` like a person selecting it.
module.exports.drag = async (page, sel, str) => {
  const rs = await module.exports.rects(page, sel, str);
  const a = rs[0], b = rs[rs.length - 1];
  await page.mouse.move(a.left + 1, (a.top + a.bottom) / 2);
  await page.mouse.down();
  await page.mouse.move((a.left + b.right) / 2, (b.top + b.bottom) / 2, { steps: 4 });
  await page.mouse.move(b.right - 1, (b.top + b.bottom) / 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(350);
};
// 8.32: the middle of the note badge of the annotation with this group or text (the top right
// corner of its last line, where the badge sits), for hovering it.
module.exports.badge = (page, key) => page.evaluate(k => {
  const w = window.__hl.allWrappers().filter(w => w.getAttribute('data-highlighter-group') === k || w.textContent === k).find(w => w.hasAttribute('data-highlighter-note-mark'));
  const r = w && Array.from(w.getClientRects()).filter(r => r.width).pop();
  return r ? [r.right, r.top] : null;
}, key);
