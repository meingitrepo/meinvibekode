// Timers and caches that must not act on stale state: a selection preview's timers, the strike-through font
// metrics, and the 1 s poll while the tab is hidden.
const L = require('./lib');
const CTX = 24;
const KEY = 'https://example.test/a';
const P1 = 'Short first paragraph with alpha note words in it.';
const P2 = 'Second paragraph with gamma note words in it too.';
const rec = (xpath, block, text, group, extra) => { const at = block.indexOf(text); return { xpath, startOffset: at, length: text.length, key: 'h', text, prefix: block.slice(Math.max(0, at - CTX), at), suffix: block.slice(at + text.length, at + text.length + CTX), group, ...extra }; };
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px;max-width:360px">
<p id="p1">${P1}</p><p id="p2" style="margin-top:260px">${P2}</p></body></html>`;
const store = { [KEY]: JSON.stringify([rec('//*[@id="p1"]', P1, 'alpha note', 'gA', { note: 'Note A' }), rec('//*[@id="p2"]', P2, 'gamma note', 'gB', { note: 'Note B' })]) };
const init = () => {
  try { delete window.navigation; Object.defineProperty(window, "navigation", { value: undefined, configurable: true }); } catch (e) {}
  window.__ticks = 0; window.__mx = { a: 10, d: 4, x: 5 };
  const si = window.setInterval; window.setInterval = (fn, ms, ...r) => si(ms === 1000 ? (...a) => { window.__ticks++; return fn(...a); } : fn, ms, ...r);
  CanvasRenderingContext2D.prototype.measureText = function () { const m = window.__mx; return { fontBoundingBoxAscent: m.a, fontBoundingBoxDescent: m.d, actualBoundingBoxAscent: m.x }; };
};
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html: HTML, store, init });
  const shown = () => page.evaluate(() => !window.__hl.noteCardEl.hidden && window.__hl.cardText.textContent);
  const click = async sel => { const r = (await L.rects(page, sel[0], sel[1]))[0]; await page.mouse.click(r.left + 4, (r.top + r.bottom) / 2); return r; };

  // (a) The pointer takes over a selection preview; a second selection then gets its own full idle time.
  const ra = await click(['#p1', 'alpha note']); await page.waitForTimeout(400);
  L.check('(a) the first preview shows', (await shown()) === 'Note A', await shown());
  await page.mouse.move(ra.right + 2, (ra.top + ra.bottom) / 2); await page.mouse.move(ra.right + 3, (ra.top + ra.bottom) / 2);   // on the badge: the pointer takes over
  await page.waitForTimeout(1500);
  await click(['#p2', 'gamma note']);
  await page.waitForTimeout(400); 
  L.check('(a) the second preview shows', (await shown()) === 'Note B', await shown());
  await page.mouse.move(600, 600); await page.mouse.move(610, 610);
  await page.waitForTimeout(2300);   // the first selection's idle time ran out ~0.5 s ago; the second one's has ~1.2 s to go
  L.check('(a) the first selection\'s idle timer does not hide the second preview early', (await shown()) === 'Note B', await shown());

  // (b) Font metrics: nothing unusable is cached, and a finished font load drops what was measured before it.
  const m = () => page.evaluate(() => window.__hl.fontMetrics(document.getElementById('p1')));
  await page.evaluate(() => { window.__mx = { a: 0, d: 0, x: 0 }; });
  L.check('(b) an unmeasurable font gives null', (await m()) === null, await m());
  await page.evaluate(() => { window.__mx = { a: 10, d: 4, x: 5 }; });
  L.check('(b) null is not cached', (await m() || {}).ascent === 10, await m());
  await page.evaluate(() => { window.__mx = { a: 20, d: 8, x: 10 }; });
  L.check('(b) a measured font stays cached', (await m() || {}).ascent === 10, await m());
  await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
  L.check('(b) a finished font load drops the cache', (await m() || {}).ascent === 20, await m());

  // (c) The poll stops while the tab is hidden and runs once at once when it is shown.
  const setHidden = h => page.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, h);
  const ticks = () => page.evaluate(() => window.__ticks);
  const key = () => page.evaluate(() => window.__hl.currentKey);
  await setHidden(true); const t0 = await ticks();
  await page.evaluate(() => history.pushState(null, '', '/b'));   // only the poll notices this (no Navigation API here)
  await page.waitForTimeout(2500);
  L.check('(c) no poll ticks while hidden', (await ticks()) === t0, [t0, await ticks()]);
  L.check('(c) the URL change is not looked for while hidden', (await key()) === KEY, await key());
  await setHidden(false); await page.waitForTimeout(900);   // the poll alone would take up to 1 s, then the settle time
  L.check('(c) shown again, the URL change is noticed at once', (await key()) !== KEY, await key());
  await page.waitForTimeout(2200);
  L.check('(c) the poll runs again once shown', (await ticks()) >= t0 + 2, [t0, await ticks()]);

  L.check('no page errors', page.__errors.length === 0, page.__errors);
  await b.close();
  console.log(L.fails ? `${L.fails} FAILED` : 'ALL PASS'); process.exit(L.fails ? 1 : 0);
})();
