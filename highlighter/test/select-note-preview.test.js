// Selecting an annotation with a note shows the note, closing after SELECT_PREVIEW_MS idle.
const L = require('./lib');
const CTX = 24;
const KEY = 'https://example.test/a';
const P1 = 'Short first paragraph with alpha note words in it.';
const P3 = 'Third paragraph with beta plain words in it.';
const rec = (xpath, block, text, group, extra) => { const at = block.indexOf(text); return { xpath, startOffset: at, length: text.length, key: 'h', text, prefix: block.slice(Math.max(0, at - CTX), at), suffix: block.slice(at + text.length, at + text.length + CTX), group, ...extra }; };
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px;max-width:360px">
<p id="p1">${P1}</p><p id="p3">${P3}</p></body></html>`;
const store = { [KEY]: JSON.stringify([rec('//*[@id="p1"]', P1, 'alpha note', 'gA', { note: 'Note A' }), rec('//*[@id="p3"]', P3, 'beta plain', 'gB', {})]) };
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html: HTML, store });
  const shown = () => page.evaluate(() => !window.__hl.noteCardEl.hidden && window.__hl.cardText.textContent);
  const click = async sel => { const r = (await L.rects(page, sel[0], sel[1]))[0]; await page.mouse.click(r.left + 4, (r.top + r.bottom) / 2); await page.mouse.move(r.left + 4, r.bottom + 60); };
  await click(['#p1', 'alpha note']); await page.waitForTimeout(450);
  L.check('selecting an annotation with a note shows its note', (await shown()) === 'Note A', await shown());
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // The preview opens a little after the click (the selection settles in 200ms, then ~150ms).
  await page.evaluate(() => { const h = window.__hl; window.__t = {}; document.addEventListener('pointerup', () => { window.__t.up = performance.now(); }, { once: true, capture: true }); (function f() { if (!h.noteCardEl.hidden && !window.__t.card) window.__t.card = performance.now(); if (!window.__t.card) requestAnimationFrame(f); })(); });
  await click(['#p1', 'alpha note']); await page.waitForTimeout(600);
  const t = await page.evaluate(() => window.__t);
  L.check('the preview appears a little after the click (~350ms)', !!t.card && !!t.up && t.card - t.up >= 300 && t.card - t.up <= 550, t);
  await page.mouse.move(300, 400); await page.mouse.move(310, 410); await page.waitForTimeout(500);
  L.check('moving the pointer elsewhere keeps it', (await shown()) === 'Note A', await shown());
  await page.waitForTimeout(3300);
  L.check('it hides after the idle time', (await shown()) === false, await shown());
  await click(['#p1', 'alpha note']); await page.waitForTimeout(450);
  await click(['#p3', 'beta plain']); await page.waitForTimeout(450);
  L.check('selecting an annotation without a note shows nothing', (await shown()) === false, await shown());
  await click(['#p1', 'alpha note']); await page.waitForTimeout(450);
  const r = (await L.rects(page, '#p3', 'Third'))[0];
  await page.mouse.click(r.left + 2, (r.top + r.bottom) / 2); await page.waitForTimeout(450);
  L.check('clicking elsewhere closes it', (await shown()) === false, await shown());
  await click(['#p1', 'alpha note']); await page.waitForTimeout(450);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  L.check('Esc closes it', (await shown()) === false, await shown());
  // Alt+L pins the preview of the selected annotation; its tip names the key.
  await click(['#p1', 'alpha note']); await page.waitForTimeout(450);
  L.check('the Pin button names Alt+L', (await page.evaluate(() => window.__hl.cardPin.getAttribute('aria-label'))) === 'Pin note (Alt+L)', null);
  await L.altKey(page, 'l'); await page.waitForTimeout(300);
  const pinned = () => page.evaluate(() => document.querySelectorAll('[data-highlighter-note-pin]').length);
  L.check('Alt+L pins the shown note', (await pinned()) === 1, await pinned());
  await L.altKey(page, 'l'); await page.waitForTimeout(300);
  L.check('Alt+L again unpins it', (await pinned()) === 0, await pinned());
  L.check('no page errors', page.__errors.length === 0, page.__errors);
  await b.close();
  console.log(L.fails ? `${L.fails} FAILED` : 'ALL PASS'); process.exit(L.fails ? 1 : 0);
})();
