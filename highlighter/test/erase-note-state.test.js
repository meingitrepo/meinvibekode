// 9.36: in the Add note editor Erase note is grayed out (nothing saved yet); in Edit note it is available.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px"><p id="p">Alpha bravo charlie delta echo.</p></body></html>`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  const erase = () => page.evaluate(() => { const x = [...window.__hl.uiRoot.querySelectorAll('button')].find(e => e.dataset.label === 'Erase note'); return x && x.disabled; });
  await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'KeyN'); await page.waitForTimeout(200);
  L.check('Add note: Erase note is disabled', (await erase()) === true, await erase());
  await page.keyboard.type('hi'); await page.waitForTimeout(100);
  L.check('Add note: still disabled while typing', (await erase()) === true, await erase());
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);
  await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'KeyN'); await page.waitForTimeout(200);
  L.check('Edit note: Erase note is available', (await erase()) === false, await erase());
  await b.close();
})();
