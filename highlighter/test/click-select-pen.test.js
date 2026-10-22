// Clicking an annotation selects it with the pen on too; a pen drag still annotates.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet.</p></body></html>`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  await L.selStr(page, '#p', 'bravo', { endStr: 'charlie' });
  await L.altKey(page, 'KeyH');
  await page.mouse.move(800, 600);
  await L.altKey(page, 'KeyP');
  L.check('pen on', await page.evaluate(() => !!window.__hl.penKey), null);
  const pt = await page.evaluate(() => { const r = window.__hl.allWrappers()[0].getClientRects()[0]; return { x: r.left + 5, y: r.top + r.height / 2 }; });
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(150);
  L.check('click selects with pen on', await page.evaluate(() => window.__hl.selectedGroups.length === 1), null);
  L.check('pen still on', await page.evaluate(() => !!window.__hl.penKey), null);
  await b.close();
})();
