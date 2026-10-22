// The note card shows with the selection toolbar of a clicked annotation and goes with it.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px;padding-top:120px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet.</p></body></html>`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  await L.selStr(page, '#p', 'bravo', { endStr: 'echo' });
  await L.altKey(page, 'KeyH');
  await page.evaluate(() => getSelection().removeAllRanges());
  const at = () => page.evaluate(() => { const r = window.__hl.allWrappers()[0].getClientRects()[0]; return { x: r.left + 5, y: r.top + r.height / 2 }; });
  let q = await at(); await page.mouse.click(q.x, q.y); await page.waitForTimeout(400);
  await page.keyboard.press('KeyN'); await page.waitForTimeout(300);
  await page.keyboard.type('hello note'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(500);
  await page.keyboard.press('Escape'); await page.mouse.click(900, 650); await page.waitForTimeout(500);
  await page.mouse.move(900, 650); await page.waitForTimeout(500);
  const card = () => page.evaluate(() => !window.__hl.noteCardEl.hidden);
  L.check('no card before selecting', !(await card()), null);
  const pt = await page.evaluate(() => { const r = window.__hl.allWrappers()[0].getClientRects()[0]; return { x: r.left + 5, y: r.top + r.height / 2 }; });
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(400);
  L.check('card shows with toolbar', await card() && !!(await L.toolbar(page)), null);
  await page.mouse.move(900, 600); await page.waitForTimeout(600);
  L.check('card stays while toolbar does', await card(), null);
  await page.waitForTimeout(4800);
  L.check('card gone with toolbar', !(await card()) && !(await L.toolbar(page)), null);
  L.done(b);
})();
