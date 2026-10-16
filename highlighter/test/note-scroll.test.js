// 8.28: the wheel over the note editor or the note card never scrolls the page.
const L = require('./lib');
const P1 = 'Short first paragraph with alpha note words in it.';
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px;max-width:360px">
<p style="margin-top:300px" id="p1">${P1}</p><div style="height:3000px"></div></body></html>`;
const at = P1.indexOf('alpha note');
const LONGNOTE = Array.from({ length: 40 }, (_, i) => `Line ${i + 1}`).join('\n');
const store = { 'https://example.test/a': JSON.stringify([{ xpath: '//*[@id="p1"]', startOffset: at, length: 10, key: 'h', text: 'alpha note', prefix: P1.slice(0, at), suffix: P1.slice(at + 10), group: 'gA', note: LONGNOTE }]) };
const center = r => [(r.left + r.right) / 2, (r.top + r.bottom) / 2];
const box = (p, name) => p.evaluate(n => { const [el, sel] = n.split(' '); const b = (sel ? window.__hl[el].querySelector(sel) : window.__hl[el]).getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; }, name);
const scrollY = p => p.evaluate(() => scrollY);
async function wheel(p, xy, dy) { await p.mouse.move(...xy); for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, dy); await p.waitForTimeout(60); } await p.waitForTimeout(200); }

(async () => {
  const browser = await L.launch();
  const { page: p } = await L.open(browser, { html: HTML, store });
  await p.evaluate(() => scrollTo(0, 100)); await p.waitForTimeout(100);
  await p.mouse.move(...await L.badge(p, 'gA')); await p.waitForTimeout(500);   // 8.32: the card opens at the badge
  // The card: its text scrolls; past its end, and over its footer, the page stays put.
  const ct = await box(p, 'cardText');
  await wheel(p, center(ct), 400);
  L.check('the card text scrolls', await p.evaluate(() => window.__hl.cardText.scrollTop > 0), null);
  L.check('scrolling the card past its end leaves the page', (await scrollY(p)) === 100, await scrollY(p));
  const cf = await box(p, 'cardHint');
  await wheel(p, center(cf), 200);
  L.check('scrolling over the card footer leaves the page', (await scrollY(p)) === 100, await scrollY(p));
  await L.altKey(p, 'n'); await p.waitForTimeout(200);   // the mouse is on the card: its annotation
  L.check('the editor is open', await p.evaluate(() => !!window.__hl.editor), null);
  const ta = await box(p, 'noteInput');
  await wheel(p, center(ta), 400);
  L.check('the long note scrolls', await p.evaluate(() => window.__hl.noteInput.scrollTop > 0), null);
  L.check('scrolling the note past its end leaves the page', (await scrollY(p)) === 100, await scrollY(p));
  await wheel(p, center(ta), -2000);
  L.check('back up past its start too', (await scrollY(p)) === 100 && await p.evaluate(() => window.__hl.noteInput.scrollTop === 0), await scrollY(p));
  const tt = await box(p, 'editorEl .editor-title');
  await wheel(p, center(tt), 200);
  L.check('scrolling over the editor title leaves the page', (await scrollY(p)) === 100, await scrollY(p));
  // A short note that doesn't scroll at all.
  await p.keyboard.press('Control+a'); await p.keyboard.type('Short'); await p.waitForTimeout(100);
  await wheel(p, center(await box(p, 'noteInput')), 200);
  L.check('scrolling over a short note leaves the page', (await scrollY(p)) === 100, await scrollY(p));
  L.check('the editor is still open', await p.evaluate(() => !!window.__hl.editor), null);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.mouse.move(5, 650); await p.mouse.wheel(0, 200); await p.waitForTimeout(300);
  L.check('the wheel elsewhere still scrolls the page', (await scrollY(p)) > 100, await scrollY(p));
  L.check('no page errors', p.__errors.length === 0, p.__errors);
  await L.done(browser);
})();
