// The dashed outline of a selected annotation hides under the page's fixed and sticky bars, as
// the annotation does (playground S1 under its sticky bar), and scrolls with the page in step.
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
  const state = () => page.evaluate(() => {
    const box = window.__hl.selectBoxesEl.querySelector('.select-box'); const bb = box.getBoundingClientRect();
    const bar = document.querySelector('.bar').getBoundingClientRect();
    const covers = Array.from(box.querySelectorAll('mask g rect'), r => ['x', 'y', 'width', 'height'].map(k => +r.getAttribute(k)));
    return { covers: covers.map(([x, y, w, h]) => [bb.left + x, bb.top + y, w, h]), bar: [bar.left, bar.top, bar.width, bar.height], box: [bb.top, bb.bottom] };
  });
  let s = await state();
  L.check('nothing over it, nothing hidden', s.covers.length === 0, s);
  // The outline scrolls with the page in the same frame: right after a scroll, before the
  // script's next frame, it is still where the text is.
  const lag = await page.evaluate(() => {
    const box = window.__hl.selectBoxesEl.querySelector('.select-box');
    const gap = () => box.getBoundingClientRect().top - window.__hl.allWrappers()[0].getBoundingClientRect().top;
    const was = gap(); scrollBy({ top: 37, behavior: 'instant' }); const now = gap(); scrollBy({ top: -37, behavior: 'instant' });
    return { was, now };
  });
  L.check('scrolls with the text, no lag', Math.abs(lag.now - lag.was) < 0.5, lag);
  await page.waitForTimeout(100);
  // Scroll the text partly under the bar.
  await page.evaluate(() => { const bar = document.querySelector('.bar').getBoundingClientRect(); const r = window.__hl.allWrappers()[0].getBoundingClientRect(); scrollBy({ top: r.top + r.height / 2 - bar.height, behavior: 'instant' }); });
  await page.waitForTimeout(150);
  s = await state();
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1);
  L.check('hidden under the sticky bar', s.covers.length === 1 && near(s.covers[0], s.bar) && s.box[0] < s.bar[3], s);
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, clip: { x: 0, y: 0, width: 560, height: 110 } });
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await page.waitForTimeout(150);
  s = await state();
  L.check('back in the open, whole again', s.covers.length === 0, s);
  L.check('no page errors', !page.__errors.length, page.__errors);
  await L.done(b);
})();
