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
  // The leading icon is shown and is the one of the menu button the toast belongs to.
  const toastIs = (page, id) => page.evaluate(i => {
    const svg = window.__hl.toastEl.querySelector(':scope > svg.icon');
    const want = (i === 'copy' ? window.__hl.panelCopy : window.__hl.menuButtons.get(i)).querySelector('svg path.ic').getAttribute('d');
    return !!svg && getComputedStyle(svg).display !== 'none' && svg.querySelector('path.ic').getAttribute('d') === want;
  }, id);
  const menuIcon = (page, id) => page.evaluate(i => window.__hl.menuButtons.get(i).querySelector('svg path.ic').getAttribute('d').slice(0, 11), id);
  L.check('menu: Shortcuts uses the command icon', (await menuIcon(page, 'keys')) === 'M180,146H15', await menuIcon(page, 'keys'));
  L.check('menu: Search all pages uses the binoculars icon', (await menuIcon(page, 'search')) === 'M233,147.24', await menuIcon(page, 'search'));
  await L.altKey(page, 'k', true); await says('shortcut keys off', 'Shortcuts disabled');
  L.check('Shortcuts toast carries the command icon', await toastIs(page, 'keys'), null);
  await L.altKey(page, 'k', true); await says('shortcut keys on', 'Shortcuts enabled');
  await L.altKey(page, 't'); await says('selection toolbar off', 'Selection toolbar disabled');
  L.check('toolbar toast carries the highlighter icon', await toastIs(page, 'toolbar'), null);
  await L.altKey(page, 't'); await says('selection toolbar on', 'Selection toolbar enabled');
  await L.altKey(page, 'p'); await says('pen on', 'Pen mode enabled');
  L.check('pen toast carries the pencil icon', await toastIs(page, 'pen'), null);
  await L.altKey(page, 'p'); await says('pen off', 'Pen mode disabled');
  L.check('menu: the pen button is called Pen mode', (await page.evaluate(() => window.__hl.menuButtons.get('pen').dataset.label)) === 'Pen mode', null);
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
  L.check('copy toast carries the copy icon', await toastIs(page, 'copy'), null);
  await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
