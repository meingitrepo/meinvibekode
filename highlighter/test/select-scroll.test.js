// The dashed outline of a selected annotation scrolls with the page in step (8.21). It draws
// over the page's fixed and sticky bars again since 8.22, which dropped 8.21's check for them.
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const html = fs.readFileSync(path.join(__dirname, 'playground.html'), 'utf8').replace('<p>The quick brown fox', '<p id="fox">The quick brown fox');
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  await L.selStr(page, '#fox', 'The quick brown fox jumps');
  await L.altKey(page, 'KeyH');
  const pt = await page.evaluate(() => { const r = window.__hl.allWrappers()[0].getClientRects()[0]; return { x: r.left + 4, y: r.top + r.height / 2 }; });
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(100);
  L.check('outlined', await page.evaluate(() => !!window.__hl.selectBoxesEl.querySelector('.select-box:not([hidden])')), null);
  // The outline scrolls with the page in the same frame: right after a scroll, before the
  // script's next frame, it is still where the text is.
  const lag = await page.evaluate(() => {
    const box = window.__hl.selectBoxesEl.querySelector('.select-box');
    const gap = () => box.getBoundingClientRect().top - window.__hl.allWrappers()[0].getBoundingClientRect().top;
    const was = gap(); scrollBy({ top: 37, behavior: 'instant' }); const now = gap(); scrollBy({ top: -37, behavior: 'instant' });
    return { was, now };
  });
  L.check('scrolls with the text, no lag', Math.abs(lag.now - lag.was) < 0.5, lag);
  L.check('no page errors', !page.__errors.length, page.__errors);
  await L.done(b);
})();
