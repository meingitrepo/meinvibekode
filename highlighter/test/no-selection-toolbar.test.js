// There is no selection toolbar: selecting text or clicking an annotation shows none, the menu has
// no switch for it and Alt+T does nothing. Annotating by shortcut still works.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet.</p></body></html>`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  await L.selStr(page, '#p', 'bravo', { endStr: 'charlie' });
  await page.waitForTimeout(500);
  L.check('no toolbar element', await page.evaluate(() => window.__hl.toolbarEl === undefined), null);
  L.check('no toolbar shown in the UI', await page.evaluate(() => [...window.__hl.uiRoot.querySelectorAll('[role=toolbar]')].every(el => !el.checkVisibility())), null);
  await L.altKey(page, 'KeyH');
  L.check('Alt+H still annotates', await page.evaluate(() => window.__hl.allWrappers().length === 1), null);
  await page.mouse.move(800, 600);
  const pt = await page.evaluate(() => { const r = window.__hl.allWrappers()[0].getClientRects()[0]; return { x: r.left + 5, y: r.top + r.height / 2 }; });
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(500);
  L.check('click selects the annotation', await page.evaluate(() => window.__hl.selectedGroups.length === 1), null);
  L.check('no toolbar for a clicked annotation', await page.evaluate(() => [...window.__hl.uiRoot.querySelectorAll('[role=toolbar]')].every(el => !el.checkVisibility())), null);
  L.check('menu has no toolbar button', await page.evaluate(() => !window.__hl.menuButtons.has('toolbar') && ![...window.__hl.menuButtons.values()].some(x => /toolbar/i.test(x.dataset.label))), null);
  const before = await page.evaluate(() => JSON.stringify(window.__gm['rnh:settings'] || null));
  await page.keyboard.press('Escape');
  await L.selStr(page, '#p', 'echo');
  await L.altKey(page, 'KeyT'); await page.waitForTimeout(300);
  L.check('Alt+T leaves settings alone', await page.evaluate(s => JSON.stringify(window.__gm['rnh:settings'] || null) === s, before), null);
  L.check('Alt+T shows no toast', await page.evaluate(() => window.__hl.toastEl.hidden || !window.__hl.toastEl.checkVisibility()), null);
  await L.done(b);
})();
