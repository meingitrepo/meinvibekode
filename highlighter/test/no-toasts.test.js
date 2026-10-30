// 9.25: toasts say what happened (switches enabled/disabled, erase and note removal with Undo, copy count, Undone/Redone with
// the opposite link). Copy no longer swaps its icon for a check. (File name kept from 9.7, when most of these were removed.)
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px">
<p id="p1">Light paragraph one with words to select and more words after them.</p></body></html>`;
const icon = page => page.evaluate(() => window.__hl.panelCopy.querySelector('svg').innerHTML);
(async () => {
  const browser = await L.launch();
  const { page } = await L.open(browser, { html: HTML });
  const says = async (name, want) => L.check(`${name}: "${want}"`, (await L.toast(page)) === want, await L.toast(page));
  await L.altKey(page, 'k', true); await says('shortcut keys off', 'Shortcuts disabled');
  await L.altKey(page, 'k', true); await says('shortcut keys on', 'Shortcuts enabled');
  await L.altKey(page, 't'); await says('selection toolbar off', 'Selection toolbar disabled');
  await L.altKey(page, 't'); await says('selection toolbar on', 'Selection toolbar enabled');
  await L.altKey(page, 'p'); await says('pen on', 'Pen enabled');
  await L.altKey(page, 'p'); await says('pen off', 'Pen disabled');
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(300);
  await L.altKey(page, 'h'); await page.waitForTimeout(300);
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(300);
  await L.altKey(page, 'd'); await page.waitForTimeout(300);
  await says('erase', '1 annotation erased · Undo');
  await page.evaluate(() => window.__hl.toastAction.click()); await page.waitForTimeout(300);
  L.check('the Undo link brings the annotation back', (await L.wr(page)).length === 1, await L.wr(page));
  await says('after the link', 'Undone · Redo');
  await page.evaluate(() => window.__hl.toastAction.click()); await page.waitForTimeout(300);
  L.check('the Redo link erases it again', (await L.wr(page)).length === 0, await L.wr(page));
  await says('after Redo', 'Redone · Undo');
  await L.altKey(page, 'z'); await page.waitForTimeout(300);
  L.check('Alt+Z undoes the erase', (await L.wr(page)).length === 1, await L.wr(page));
  await says('Alt+Z', 'Undone · Redo');
  // Copy: the icon stays, a toast says how many were copied.
  await page.evaluate(() => window.__hl.openPanel()); await page.waitForTimeout(300);
  await page.evaluate(() => window.__hl.panelSelectAll.click()); await page.waitForTimeout(200);
  const before = await icon(page);
  await page.evaluate(() => window.__hl.panelCopy.click()); await page.waitForTimeout(300);
  L.check('copy: the icon does not change', (await icon(page)) === before, null);
  L.check('copy: markdown was copied', await page.evaluate(() => !!window.__clip), null);
  await says('copy', '1 annotation copied');
  await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
