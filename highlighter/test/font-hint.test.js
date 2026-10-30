// 9.20: a hint names the UI fonts (Poppins, Lora) that are not installed. (9.31: no toast has a button; the panel carries the download links, see panel-font-note.test.js)
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px">
<p id="p1">Light paragraph one with words to select and more words after them.</p></body></html>`;
(async () => {
  const browser = await L.launch();
  const { page } = await L.open(browser, { html: HTML });
  // Task 1: the hint. The canvas is stubbed: a font named in window.__installed measures wider than the fallback.
  const init = (installed, extra = '') => `window.__installed = ${JSON.stringify(installed)}; window.__mtCalls = 0; window.__opened = [];
    CanvasRenderingContext2D.prototype.measureText = function () { window.__mtCalls++; return { width: window.__installed.some(n => this.font.includes(n)) ? 20 : 10 }; };
    window.open = (u, t, f) => { window.__opened.push([u, f]); return null; }; ${extra}`;
  const POPPINS = 'https://fonts.google.com/specimen/Poppins', LORA = 'https://fonts.google.com/specimen/Lora';
  const saved = p => p.evaluate(() => { try { return JSON.parse(window.__gm['rnh:settings']).fontHintVersion; } catch (e) { return 'unreadable'; } });
  const hintPage = async (opts, installed = [], extra = '', wait = 3600) => { const r = await L.open(browser, Object.assign({ html: HTML, fontHint: true, init: init(installed, extra) }, opts)); await r.page.waitForTimeout(wait); return r.page; };
  const shown = p => p.evaluate(() => ({ text: window.__hl.toastEl.hidden ? null : window.__hl.toastText.textContent, buttons: window.__hl.toastEl.querySelectorAll('button').length }));
  let p = await hintPage({});
  let s = await shown(p);
  L.check('both missing: names both, no buttons', s.text === 'Poppins and Lora not installed; using Arial and Georgia.' && s.buttons === 0, s);
  const lay = await p.evaluate(() => ({ toastH: Math.round(window.__hl.toastEl.getBoundingClientRect().height), textW: Math.round(window.__hl.toastText.getBoundingClientRect().width) }));
  L.check('both missing: a tooltip-sized, one-line toast with a readable width', lay.textW > 150 && lay.toastH <= 48, lay);
  L.check('both missing: the version is recorded when shown', (await saved(p)) === '9.99', await saved(p));
  await L.altKey(p, 't'); await L.altKey(p, 't');
  L.check('a settings write elsewhere keeps the recorded version', (await saved(p)) === '9.99', await saved(p));
  L.check('no page errors while the hint ran', !p.__errors.length, p.__errors);
  p = await hintPage({}, ['Poppins']);
  s = await shown(p);
  L.check('only Lora missing: names Lora and Georgia, no button', s.text === 'Lora not installed; using Georgia.' && s.buttons === 0, s);
  p = await hintPage({ store: { 'rnh:settings': JSON.stringify({ fontHintVersion: '9.99' }) } });
  L.check('same version recorded: no toast, no font measuring', (await shown(p)).text === null && (await p.evaluate(() => window.__mtCalls)) === 0, [await shown(p), await p.evaluate(() => window.__mtCalls)]);
  p = await hintPage({ store: { 'rnh:settings': JSON.stringify({ fontHintVersion: '9.98' }) } });
  L.check('older version recorded: shown again and recorded', (await shown(p)).text !== null && (await saved(p)) === '9.99', [await shown(p), await saved(p)]);
  p = await hintPage({}, ['Poppins', 'Lora']);
  L.check('both installed: no toast, nothing recorded', (await shown(p)).text === null && (await saved(p)) === undefined, [await shown(p), await saved(p)]);
  p = await hintPage({ hidden: true });
  L.check('hidden tab: no toast, nothing recorded (it comes back next load)', (await shown(p)).text === null && (await saved(p)) === undefined, [await shown(p), await saved(p)]);
  p = await hintPage({ defaults: true });
  L.check('site where the tool is off: no hint, nothing recorded', (await shown(p)).text === null && (await saved(p)) === undefined, [await shown(p), await saved(p)]);
  p = await hintPage({}, [], 'window.__noGmInfo = true;');
  L.check('no script version from the manager: no hint', (await shown(p)).text === null && (await saved(p)) === undefined, [await shown(p), await saved(p)]);
  const rec = { xpath: '//*[@id="p1"]', startOffset: 6, length: 4, key: 'h', text: 'gone', prefix: 'zzzzz ', suffix: ' yyyyy', group: 'mg0abcde00002' };
  p = await hintPage({ store: { 'https://example.test/a': JSON.stringify([rec]) } }, [], '', 14000);
  await L.until(p, () => /not found/.test(window.__hl.toastText.textContent) && !window.__hl.toastEl.hidden, null, 8000);
  s = await shown(p);
  L.check('annotations not found: the notice shows, the hint waits behind it, nothing recorded', /not found/.test(s.text || '') && (await saved(p)) === undefined, [s, await saved(p)]);
  await browser.close();
  console.log('FAILS', L.fails);
  process.exit(L.fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
