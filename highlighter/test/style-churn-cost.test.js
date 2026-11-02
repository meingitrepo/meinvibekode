// A page that changes a class or style every frame (carousel, progress bar, hover toggling) must not
// make the script measure its annotations every frame, and costs nothing while there are none.
const L = require('./lib');
const W = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima'.split(' ');
const TEXT = W.join(' ');
const rec = (word, g) => {
  const at = TEXT.indexOf(word);
  return { xpath: '//*[@id="p"]', startOffset: at, length: word.length, key: 'h', text: word,
    prefix: TEXT.slice(Math.max(0, at - 24), at), suffix: TEXT.slice(at + word.length, at + word.length + 24), group: `g${g}` };
};
const html = `<!doctype html><html><body style="font:18px/1.6 serif;margin:40px;width:420px"><p id="p">${TEXT}</p><div id="bar" style="height:4px"></div></body></html>`;
// Counts wrapper measurements and selector matches while the page restyles #bar every frame for 1.5 s.
const churn = page => page.evaluate(() => new Promise(done => {
  const c = { rects: 0, matches: 0, frames: 0 };
  const gcr = Element.prototype.getClientRects, mt = Element.prototype.matches;
  Element.prototype.getClientRects = function () { if (this.hasAttribute && this.hasAttribute('data-highlighter-wrapper')) c.rects++; return gcr.call(this); };
  Element.prototype.matches = function (s) { c.matches++; return mt.call(this, s); };
  const bar = document.getElementById('bar'), t0 = performance.now();
  (function tick() {
    bar.style.width = (c.frames++ % 100) + 'px'; bar.classList.toggle('x');
    if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
    else setTimeout(() => { Element.prototype.getClientRects = gcr; Element.prototype.matches = mt; done(c); }, 400);
  })();
}));
(async () => {
  const b = await L.launch();
  {
    const store = { 'https://example.test/a': JSON.stringify([rec('bravo', 1), rec('golf', 2), rec('kilo', 3)]) };
    const { page } = await L.open(b, { html, store });
    await page.waitForFunction(() => window.__hl.allWrappers().length === 3);
    await page.waitForTimeout(400);
    const c = await churn(page);
    // 3 wrappers, 1.9 s: one look per ~200 ms is about 10 looks (30 measurements); every frame is about 100 (300).
    L.check('annotations on the page: measured at most ~once per 200 ms under constant restyling', c.rects <= 60 && c.frames > 40, c);
    await page.context().close();
  }
  {
    const { page } = await L.open(b, { html });
    await page.waitForTimeout(400);
    const c = await churn(page);
    L.check('no annotations: restyling costs the script no selector matches', c.matches === 0 && c.frames > 40, c);
    await page.context().close();
  }
  await L.done(b);
})();
