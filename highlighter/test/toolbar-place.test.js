// 7.35: the selection toolbar is centered over the selection, above it, flipping below near the top
// and staying on screen for tall selections.
const L = require('./lib');
const long = Array.from({ length: 60 }, (_, i) => `Sentence ${i} of a very long paragraph that keeps going for a while.`).join(' ');
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title><style>
  body { background:#fff; color:#111; font:16px/1.6 sans-serif; margin:4px 40px; max-width: 700px }
</style></head><body>
<p id="top">Top line words right at the very top of the page.</p>
${Array.from({ length: 10 }, (_, i) => `<p>Filler ${i}.</p>`).join('')}
<p id="p1">Light paragraph one with words to select and some more words after them to make two lines of text here.</p>
<p id="long">${long}</p>
${Array.from({ length: 30 }, (_, i) => `<p>Filler after ${i}.</p>`).join('')}
</body></html>`;
const tb = page => L.toolbar(page).then(t => t && t.rect);
const selRect = page => page.evaluate(() => { const r = getSelection().getRangeAt(0).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, cx: r.left + r.width / 2 }; });
const centered = (t, s) => t && Math.abs(t.left + t.width / 2 - s.cx) < 3;
(async () => {
  const browser = await L.launch();
  const { ctx, page } = await L.open(browser, { html: HTML });
  for (const [name, args] of [['single line', ['#p1', 'words to select']], ['multi-line', ['#long', 'Sentence 1 ', { endStr: 'Sentence 3 of' }]],
    ['multi-line backward', ['#long', 'Sentence 1 ', { endStr: 'Sentence 3 of', backward: true }]]]) {
    await page.evaluate(() => window.scrollTo(0, document.querySelector('#p1').offsetTop - 200));
    await L.selStr(page, ...args); await page.waitForTimeout(400);
    const t = await tb(page), s = await selRect(page);
    L.check(`${name}: above the selection, centered on it`, t && t.bottom <= s.top && centered(t, s), { t, s });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await L.selStr(page, '#top', 'words right'); await page.waitForTimeout(400);
  let t = await tb(page), s = await selRect(page);
  L.check('near the top edge: flips below, centered', t && t.top >= s.bottom && centered(t, s), { t, s });
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#long').offsetTop - 50));
  await L.selStr(page, '#long', 'Sentence 0', { endStr: 'Sentence 59 of a very long paragraph that keeps going for a while.' }); await page.waitForTimeout(400);
  t = await tb(page);
  L.check('tall selection: on screen', t && t.top >= 0 && t.bottom <= 700, t);
  await page.mouse.wheel(0, 300); await page.waitForTimeout(300);
  t = await tb(page);
  L.check('after scrolling: still on screen', !t || (t.top >= 0 && t.bottom <= 700), t);
  // scrolling the selection out of the window: the toolbar goes with it (7.37)
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#p1').offsetTop - 200));
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollBy(0, 600)); await page.waitForTimeout(200);
  t = await tb(page); s = await selRect(page);
  L.check('selection scrolled off the top: toolbar at its bottom, off screen', t && Math.abs(t.top - (s.bottom + 8)) < 2 && t.bottom < 0 && centered(t, s), { t, s });
  await page.evaluate(() => { document.body.style.paddingTop = '1500px'; window.scrollTo(0, 0); }); await page.waitForTimeout(200);
  t = await tb(page); s = await selRect(page);
  L.check('selection scrolled off the bottom: toolbar at its top, off screen', t && Math.abs(t.bottom - (s.top - 8)) < 2 && t.top > 700 && centered(t, s), { t, s });
  await ctx.close(); await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
