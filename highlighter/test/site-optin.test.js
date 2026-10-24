// 9.0: sites are off until switched on; sites that already have annotations are switched on once.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px">
<p id="p1">Light paragraph one with words to select and more words after them.</p></body></html>`;
(async () => {
  const browser = await L.launch();
  let { ctx, page } = await L.open(browser, { html: HTML, menu: true, siteOff: true });
  L.check('fresh site: script is off', await page.evaluate(() => window.__hl.running === false));
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(400);
  L.check('fresh site: no toolbar', !(await L.toolbar(page)));
  await L.altKey(page, 'h'); await page.waitForTimeout(300);
  L.check('fresh site: shortcuts do nothing', (await L.stored(page)).length === 0);
  await page.evaluate(() => Object.entries(window.__menu).find(([l]) => /^Turn on for/.test(l))[1]()); await page.waitForTimeout(300);
  L.check('menu turns it on', await page.evaluate(() => window.__hl.running === true));
  L.check('saved per site', await page.evaluate(() => JSON.parse(window.__gm['rnh:settings']).enabledSites.includes('example.test')));
  const store = await page.evaluate(() => window.__gm);
  await ctx.close();
  ({ ctx, page } = await L.open(browser, { html: HTML, store, url: 'https://example.test/other' }));
  L.check('next visit: still on', await page.evaluate(() => window.__hl.running === true));
  await ctx.close();
  const rec = JSON.stringify([{ key: 'yellow', text: 'words', prefix: '', suffix: '', xpath: '/html/body/p', start: 0, end: 5 }]);
  ({ ctx, page } = await L.open(browser, { html: HTML, menu: true, siteOff: true, store: { 'https://example.test/a': rec } }));
  L.check('migration: site with annotations is on', await page.evaluate(() => window.__hl.running === true));
  await ctx.close();
  ({ ctx, page } = await L.open(browser, { html: HTML, menu: true, siteOff: true, store: { 'https://example.test/a': rec, 'rnh:settings': JSON.stringify({ disabledSites: ['example.test'] }) } }));
  L.check('migration: a site you turned off stays off', await page.evaluate(() => window.__hl.running === false));
  await ctx.close(); await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
