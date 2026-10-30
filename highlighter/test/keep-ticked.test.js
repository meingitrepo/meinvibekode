// 9.33: the note editor's button says "Erase note"; a click on the page keeps the annotations ticked in the Alt+O / Alt+Shift+O list.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet.</p><div style="height:400px" id="blank"></div></body></html>`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'KeyH');
  await L.selStr(page, '#p', 'echo'); await L.altKey(page, 'KeyH');
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.evaluate(() => window.__hl.openPanel()); await page.waitForTimeout(300);
  await page.evaluate(() => window.__hl.panelSelectAll.click()); await page.waitForTimeout(200);
  const sel = () => page.evaluate(() => window.__hl.selectedGroups.length);
  L.check('setup: both ticked annotations are selected', (await sel()) === 2, await sel());
  await page.mouse.click(300, 450); await page.waitForTimeout(200);
  L.check('a click on empty page keeps them selected (Alt+O)', (await sel()) === 2, await sel());
  await page.evaluate(() => window.__hl.closePanel && window.__hl.closePanel());
  await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'KeyN'); await page.waitForTimeout(200);
  const labels = await page.evaluate(() => [...window.__hl.uiRoot.querySelectorAll('button')].map(x => x.dataset.label));
  L.check('the note editor button is "Erase note"', labels.includes('Erase note') && !labels.includes('Delete note'), labels);
  await b.close();
})();
