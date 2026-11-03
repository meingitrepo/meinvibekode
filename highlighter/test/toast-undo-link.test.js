// 9.88: a deletion's toast carries one link that toggles that deletion: Undo brings it back and turns
// into Redo, Redo removes it again. The link goes once another change makes the step stale.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px">
<p id="p1">Alpha words here and Beta words there and Gamma words last.</p></body></html>`;
(async () => {
  const browser = await L.launch();
  const { page } = await L.open(browser, { html: HTML });
  const link = () => page.evaluate(() => { const b = window.__hl.toastLink; return b && window.__hl.toastEl.contains(b) && !window.__hl.toastEl.hidden ? b.textContent : null; });
  const click = async () => { await page.evaluate(() => window.__hl.toastLink.click()); await page.waitForTimeout(300); };
  const n = async () => (await L.wr(page)).length;
  const mark = async word => { await L.selStr(page, '#p1', word); await page.waitForTimeout(200); await L.altKey(page, 'h'); await page.waitForTimeout(300); };
  const erase = async word => { await L.selStr(page, '#p1', word); await page.waitForTimeout(200); await L.altKey(page, 'd'); await page.waitForTimeout(300); };

  await mark('Alpha words'); await erase('Alpha words');
  L.check('erase: toast says it and has an Undo link', (await L.toast(page)) === '1 annotation erased' && (await link()) === 'Undo', [await L.toast(page), await link()]);
  L.check('the link is a button inside the toast', await page.evaluate(() => window.__hl.toastLink.tagName === 'BUTTON' && window.__hl.toastEl.contains(window.__hl.toastLink)), null);
  await click();
  L.check('Undo restores, the link turns into Redo', (await n()) === 1 && (await link()) === 'Redo' && (await L.toast(page)) === '1 annotation restored', [await n(), await link(), await L.toast(page)]);
  await click();
  L.check('Redo erases again, the link turns into Undo', (await n()) === 0 && (await link()) === 'Undo' && (await L.toast(page)) === '1 annotation erased', [await n(), await link()]);
  const seen = [];
  for (let i = 0; i < 3; i++) { await click(); seen.push(await n()); }
  L.check('it toggles any number of times', seen.join() === '1,0,1', seen);
  await click();   // erased again

  // Stale: another change after the deletion takes the link away; nothing undoes the new change.
  await mark('Alpha words'); await erase('Alpha words'); await mark('Gamma words');
  L.check('a new change removes the link', (await link()) === null, await link());
  L.check('the new highlight stays', (await n()) === 1, await n());

  // Alt+Z replaces the toast; its own toast has no link.
  await erase('Gamma words');
  await L.altKey(page, 'z'); await page.waitForTimeout(300);
  L.check('Alt+Z: "Undo", no link', (await L.toast(page)) === 'Undo' && (await link()) === null, [await L.toast(page), await link()]);
  await erase('Gamma words');

  // Two erases: the second toast's link undoes only the second.
  await mark('Alpha words'); await mark('Beta words');
  await erase('Alpha words'); await erase('Beta words');
  await click();
  const texts = await page.evaluate(() => window.__hl.allWrappers().map(w => w.textContent).join('|'));
  L.check('the second erase owns the link', texts === 'Beta words', texts);

  // Keyboard: Tab from the toast reaches the link, Enter toggles.
  await click();   // Beta erased again
  await mark('Beta words'); await erase('Beta words');
  await page.evaluate(() => window.__hl.toastEl.focus());
  await page.keyboard.press('Tab');
  L.check('Tab reaches the link', await page.evaluate(() => window.__hl.uiRoot.activeElement === window.__hl.toastLink), null);
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  L.check('Enter restores, focus stays, the toast stays', (await n()) === 1 && (await link()) === 'Redo' && await page.evaluate(() => window.__hl.uiRoot.activeElement === window.__hl.toastLink), [await n(), await link()]);
  await page.evaluate(() => window.__hl.uiRoot.activeElement.blur()); await page.mouse.click(5, 5);

  // Clear page (Alt+Shift+D) and note delete get the link too.
  await L.altKey(page, 'd', true); await page.waitForTimeout(300);
  L.check('clear page: Undo link', (await L.toast(page)) === '1 annotation erased' && (await link()) === 'Undo', [await L.toast(page), await link()]);
  await click();
  L.check('clear page: Undo restores', (await n()) === 1, await n());
  L.check('no page errors', page.__errors.length === 0, page.__errors);
  await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
