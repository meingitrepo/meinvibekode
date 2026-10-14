// 7.58: selecting across overlapping highlights must not mask a square out of the outer one
// (Range.getClientRects included the inner highlight's drawing).
const L = require('./lib');
const words = Array.from({ length: 120 }, (_, i) => 'word' + i).join(' ');
const html = `<html><body style="font:18px/1.6 Georgia,serif;margin:40px;width:600px"><p id="p">${words}.</p></body></html>`;
(async () => {
  const b = await L.launch();
  for (const scheme of ['light', 'dark']) {
    const { page } = await L.open(b, { html, scheme });
    await L.selStr(page, '#p', 'word5 ', { endStr: 'word90' }); await L.altKey(page, 'KeyH');
    await L.selStr(page, '#p', 'word40 ', { endStr: 'word50' }); await L.altKey(page, 'Digit2');
    await page.mouse.move(1000, 650); await page.waitForTimeout(500);
    await L.selStr(page, '#p', 'word30 ', { endStr: 'word60' }); await page.waitForTimeout(300);
    // every mask rect must lie within a line of the selection
    const r = await page.evaluate(() => {
      const sel = getSelection().getRangeAt(0);
      const lines = Array.from(sel.getClientRects()).filter(x => x.width && x.height && x.height < 40);
      const bad = [];
      document.querySelectorAll('mask rect[fill="#000"]').forEach(m => { const h = +m.getAttribute('height'), w = +m.getAttribute('width'); if (h > 40) bad.push([w, h]); });
      document.querySelectorAll('svg[data-highlighter-selected-part] rect').forEach(m => { const h = +m.getAttribute('height'); if (h > 40) bad.push(['outline', +m.getAttribute('width'), h]); });
      return { bad, lines: lines.length };
    });
    L.check(`${scheme} no oversized mask or outline rects`, r.bad.length === 0, r);
    L.check(`${scheme} no errors`, page.__errors.length === 0, page.__errors);
  }
  await b.close();
  process.exit(L.fails ? 1 : 0);
})();
