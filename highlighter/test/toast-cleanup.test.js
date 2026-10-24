// 8.98: Undo is a text link like Restore/Show; Alt+P gets a toast; the toolbar "on" toast says how to turn it off;
// the toasts share a width range so Shortcut keys off/on don't jump.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px">
<p id="p1">Light paragraph one with words to select and more words after them.</p></body></html>`;
const info = page => page.evaluate(() => { const r = window.__hl; const t = r.toastEl; return { w: Math.round(t.getBoundingClientRect().width), body: t.querySelector('.toast-body').textContent, link: r.toastAction.className, icon: !!r.toastAction.querySelector('svg') }; });
(async () => {
  const browser = await L.launch();
  const { page } = await L.open(browser, { html: HTML });
  await L.altKey(page, 'p'); await page.waitForTimeout(300);
  L.check('pen on: no toast, the bar says it', (await L.toast(page)) === null && await page.evaluate(() => !window.__hl.penEl.hidden), await L.toast(page));
  await L.altKey(page, 'p'); await page.waitForTimeout(300);
  L.check('pen off toast', (await L.toast(page)) === 'Pen off' && /Alt\+P/.test((await info(page)).body), await info(page));
  await L.altKey(page, 't'); await page.waitForTimeout(200);
  await L.altKey(page, 't'); await page.waitForTimeout(200);
  L.check('toolbar on says how to turn off', (await L.toast(page)) === 'Selection toolbar on' && /Alt\+T/.test((await info(page)).body), await info(page));
  await L.altKey(page, 'k', true); await page.waitForTimeout(200);
  const off = await info(page);
  await L.altKey(page, 'k', true); await page.waitForTimeout(200);
  const on = await info(page);
  L.check('keys off and on have the same width', off.w === on.w && off.w >= 292 && off.w <= 360, { off, on });
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(300);
  await L.altKey(page, 'h'); await page.waitForTimeout(300);
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(300);
  await L.altKey(page, 'd'); await page.waitForTimeout(300);
  const u = await info(page);
  L.check('Undo is a text link, no icon', (await L.toast(page)) === '1 annotation erased · Undo' && u.link === 'link' && !u.icon, u);
  // Every toast has a body line.
  const body = async name => { const i = await info(page); L.check(`${name} has a body`, i.body.length > 0, i); };
  await body('Undo');
  await L.selStr(page, '#p1', 'Light paragraph'); await page.waitForTimeout(300);
  await L.altKey(page, 'h'); await page.waitForTimeout(300);
  await L.selStr(page, '#p1', 'more words'); await page.waitForTimeout(300);
  await L.altKey(page, 'h'); await page.waitForTimeout(300);
  await L.altKey(page, 'v'); await page.waitForTimeout(300);
  L.check('hidden toast', /^Annotations hidden/.test(await L.toast(page) || ''), await L.toast(page)); await body('Annotations hidden');
  await L.altKey(page, 'v'); await page.waitForTimeout(300);
  for (let i = 0; i < 3; i++) { await L.altKey(page, 'j'); await page.waitForTimeout(400); }
  L.check('wrap toast', /^Back to the first/.test(await L.toast(page) || ''), await L.toast(page)); await body('Back to the first');
  await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
