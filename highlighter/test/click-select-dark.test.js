const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px;background:#111;color:#eee"><p id="p">Alpha bravo charlie delta echo.</p></body></html>`;
(async () => { const b = await L.launch(); const { page } = await L.open(b, { html, scheme: 'dark' });
  await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'KeyH');
  const pt = await page.evaluate(() => { const r = window.__hl.allWrappers()[0].getBoundingClientRect(); return { x: r.left + 5, y: r.top + 5 }; });
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(100);
  const c = await page.evaluate(() => getComputedStyle(window.__hl.selectBoxesEl.querySelector('.select-box')).color);
  L.check('dark page box is white', c === 'rgb(255, 255, 255)', c); await b.close(); process.exit(L.fails ? 1 : 0); })();
