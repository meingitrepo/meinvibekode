// 9.2: the toolbar and the shortcuts are per site and off until switched on; other sites keep their own choice.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px">
<p id="p1">Light paragraph one with words to select and more words after them.</p></body></html>`;
(async () => {
  const browser = await L.launch();
  let { ctx, page } = await L.open(browser, { html: HTML, defaults: true, store: { 'rnh:settings': JSON.stringify({ toolbarOff: false, keysOff: false, enabledSites: [] }) } });
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(400);
  L.check('old global settings switch nothing on', await page.evaluate(() => window.__hl.running === true) && !(await L.toolbar(page)));
  await L.altKey(page, 't'); await page.waitForTimeout(300);
  L.check('Alt+T is ignored while shortcuts are off', !(await L.toolbar(page)));
  await page.evaluate(() => window.__hl.menuButtons.get('toolbar').click()); await page.waitForTimeout(400);
  L.check('the menu button switches the toolbar on for this site only', !!(await L.toolbar(page)) && await page.evaluate(() => { const c = JSON.parse(window.__gm['rnh:settings']); return c.toolbarOnSites.length === 1 && c.toolbarOnSites[0] === 'example.test'; }));
  const store = await page.evaluate(() => window.__gm);
  await ctx.close();
  ({ ctx, page } = await L.open(browser, { html: HTML, store, url: 'https://other.test/a' }));
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(400);
  L.check('another site is still off', !(await L.toolbar(page)));
  await ctx.close(); await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
