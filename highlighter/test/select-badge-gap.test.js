// 8.18: the dashed outline of a selected annotation leaves a gap around its note badge.
const L = require('./lib');
const html = `<html><body style="font:16px serif;margin:40px">
<p id="p">Select just these four words and try each style.</p></body></html>`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  await L.selStr(page, '#p', 'just', { endStr: 'style.' });
  await L.altKey(page, 'KeyH');
  const pt = await page.evaluate(() => { const r = window.__hl.allWrappers()[0].getClientRects()[0]; return { x: r.left + 4, y: r.top + r.height / 2 }; });
  const hole = () => page.evaluate(() => {
    const box = window.__hl.selectBoxesEl.querySelector('.select-box'); const h = box && box.querySelector('mask rect:last-child');
    const p = box && box.querySelector('path');
    return box && { w: +h.getAttribute('width'), mask: p.getAttribute('mask'), masked: !!box.querySelector(p.getAttribute('mask').slice(4, -1)) };
  });
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(100);
  let h = await hole();
  L.check('no note, no gap', h && h.w === 0 && h.masked, h);
  await page.keyboard.press('KeyN'); await page.waitForTimeout(200);
  await page.keyboard.type('a note'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(150);
  // The gap sits over the badge: the badge's middle is inside the hole, and the hole reaches past the outline's top right corner.
  const g = await page.evaluate(() => {
    const box = window.__hl.selectBoxesEl.querySelector('.select-box'); const b = box.getBoundingClientRect();
    const h = box.querySelector('mask rect:last-child'); const [x, y, w, ht] = ['x', 'y', 'width', 'height'].map(k => +h.getAttribute(k));
    const m = document.querySelector('[data-highlighter-note-mark]'); const rs = m.getClientRects(); const r = rs[rs.length - 1];
    return { hole: [b.left + x, b.top + y, b.left + x + w, b.top + y + ht], end: [r.right, r.top], box: [b.right, b.top] };
  });
  L.check('gap around the badge', g.hole[0] < g.end[0] && g.hole[2] > g.end[0] && g.hole[1] < g.end[1] && g.hole[3] > g.end[1]
    && g.hole[0] < g.box[0] && g.hole[2] > g.box[0] && g.hole[1] < g.box[1] && g.hole[3] > g.box[1], g);
  L.check('no page errors', !page.__errors.length, page.__errors);
  await L.done(b);
})();
