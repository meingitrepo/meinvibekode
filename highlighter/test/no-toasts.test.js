// 9.7: toasts that only repeat what is visible are gone (toggles, Pen off, menu hidden, copy and erase results, undo and
// note-restore offers); Copy shows a check on its own button instead. Alt+Z still undoes.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px">
<p id="p1">Light paragraph one with words to select and more words after them.</p></body></html>`;
const icon = page => page.evaluate(() => window.__hl.panelCopy.querySelector('svg').innerHTML);
(async () => {
  const browser = await L.launch();
  const { page } = await L.open(browser, { html: HTML });
  const quiet = async name => L.check(`${name}: no toast`, (await L.toast(page)) === null, await L.toast(page));
  await L.altKey(page, 'k', true); await L.altKey(page, 'k', true); await quiet('shortcut keys off and on');
  await L.altKey(page, 't'); await L.altKey(page, 't'); await quiet('selection toolbar off and on');
  await L.altKey(page, 'p'); await L.altKey(page, 'p'); await quiet('pen on and off');
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(300);
  await L.altKey(page, 'h'); await page.waitForTimeout(300);
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(300);
  await L.altKey(page, 'd'); await page.waitForTimeout(300);
  await quiet('erase');
  await L.altKey(page, 'z'); await page.waitForTimeout(300);
  L.check('Alt+Z still undoes the erase', (await L.wr(page)).length === 1, await L.wr(page));
  // Copy: the button's icon turns into a check for a moment, with no toast.
  await page.evaluate(() => window.__hl.openPanel()); await page.waitForTimeout(300);
  await page.evaluate(() => window.__hl.panelSelectAll.click()); await page.waitForTimeout(200);
  const before = await icon(page);
  await page.evaluate(() => window.__hl.panelCopy.click()); await page.waitForTimeout(300);
  const during = await icon(page);
  L.check('copy: icon becomes a check', during !== before, { before, during });
  L.check('copy: markdown was copied', await page.evaluate(() => !!window.__clip), null);
  await quiet('copy');
  await page.waitForTimeout(2200);
  L.check('copy: icon goes back', (await icon(page)) === before, null);
  await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
