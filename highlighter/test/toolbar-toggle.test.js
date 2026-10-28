// 7.38: Alt+T switches the selection toolbar off and on for the current site; style keys still work.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px">
<p id="p1">Light paragraph one with words to select and more words after them.</p>
<p id="p2">Second paragraph with other words to annotate here.</p></body></html>`;
(async () => {
  const browser = await L.launch();
  let { ctx, page } = await L.open(browser, { html: HTML });
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(400);
  L.check('toolbar shows when the site has it on', !!(await L.toolbar(page)));
  await L.altKey(page, 't'); await page.waitForTimeout(200);
  L.check('Alt+T hides it', !(await L.toolbar(page)));
  L.check('no toast for the switch', (await L.toast(page)) === null, await L.toast(page));
  const settings = await page.evaluate(() => JSON.parse(window.__gm['rnh:settings']));
  L.check('stored in settings', !settings.toolbarOnSites.includes('example.test'), settings);
  L.check('menu says turn on', await page.evaluate(() => Object.keys(window.__menu).some(l => l.startsWith('Turn toolbar on'))));
  await L.selStr(page, '#p2', 'other words'); await page.waitForTimeout(400);
  L.check('new selection: no toolbar', !(await L.toolbar(page)));
  await L.altKey(page, 'h'); await page.waitForTimeout(300);
  L.check('Alt+H still highlights', (await L.stored(page)).length === 1);
  const store = await page.evaluate(() => window.__gm);
  await ctx.close();
  ({ ctx, page } = await L.open(browser, { html: HTML, store, url: 'https://example.test/b' }));
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(400);
  L.check('same site, another page: still off', !(await L.toolbar(page)));
  await L.altKey(page, 't'); await page.waitForTimeout(500);
  L.check('Alt+T again: shows for the current selection', !!(await L.toolbar(page)));
  L.check('stored for this site', await page.evaluate(() => JSON.parse(window.__gm['rnh:settings']).toolbarOnSites.includes('example.test')));
  await ctx.close(); await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
