// 9.0: the sticky menu: the site switch, the tools that expand from it, hide and move.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px">
<p id="p1">Light paragraph one with words to select and more words after them.</p></body></html>`;
const click = (page, expr) => page.evaluate(`(${expr})().click()`);
const state = page => page.evaluate(() => ({
  shown: !window.__hl.menuEl.hidden && getComputedStyle(window.__hl.menuEl).display !== 'none',
  master: window.__hl.menuMaster.getAttribute('aria-checked'),
  open: window.__hl.menuEl.hasAttribute('data-open'),
  rows: Object.fromEntries([...window.__hl.menuRows].map(([k, v]) => [k, v.getAttribute('aria-checked')])),
  rect: JSON.parse(JSON.stringify(window.__hl.menuEl.getBoundingClientRect()))
}));
(async () => {
  const browser = await L.launch();
  let { ctx, page } = await L.open(browser, { html: HTML, menu: true, siteOff: true });
  let s = await state(page);
  L.check('menu shows on a site that is off', s.shown && s.master === 'false' && !s.open, s);
  L.check('default corner is top left', s.rect.left < 20 && s.rect.top < 20, s.rect);
  await click(page, '() => window.__hl.menuMaster'); await page.waitForTimeout(400);
  s = await state(page);
  L.check('master on: script runs, tools expand', await page.evaluate(() => window.__hl.running) && s.master === 'true' && s.open, s);
  L.check('all tools start on', Object.values(s.rows).every(v => v === 'true'), s.rows);
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(400);
  L.check('toolbar shows', !!(await L.toolbar(page)));
  await click(page, '() => window.__hl.menuRows.get("toolbar")'); await page.waitForTimeout(300);
  L.check('toolbar tool off: toolbar gone', !(await L.toolbar(page)));
  await L.altKey(page, 'h'); await page.waitForTimeout(300);
  L.check('toolbar off: shortcut still highlights', (await L.stored(page)).length === 1);
  await click(page, '() => window.__hl.menuRows.get("keys")'); await page.waitForTimeout(200);
  await L.selStr(page, '#p1', 'more words'); await L.altKey(page, 'h'); await page.waitForTimeout(300);
  L.check('shortcuts off: Alt+H does nothing', (await L.stored(page)).length === 1);
  await click(page, '() => window.__hl.menuRows.get("keys")'); await click(page, '() => window.__hl.menuRows.get("pen")'); await page.waitForTimeout(200);
  await L.altKey(page, 'p'); await page.waitForTimeout(200);
  L.check('pen off: Alt+P does nothing', await page.evaluate(() => window.__hl.penKey === null));
  await click(page, '() => window.__hl.menuRows.get("pen")'); await click(page, '() => window.__hl.menuRows.get("panels")'); await page.waitForTimeout(200);
  await L.altKey(page, 'o'); await page.waitForTimeout(300);
  L.check('panels off: Alt+O does nothing', await page.evaluate(() => window.__hl.panelEl.hidden));
  await click(page, '() => window.__hl.menuRows.get("panels")'); await click(page, '() => window.__hl.menuRows.get("undo")'); await page.waitForTimeout(200);
  await L.altKey(page, 'z'); await page.waitForTimeout(300);
  L.check('undo off: Alt+Z does nothing', (await L.stored(page)).length === 1);
  L.check('tools saved for this site', await page.evaluate(() => JSON.parse(window.__gm['rnh:settings']).toolsOff['example.test'].join()) === 'toolbar,undo');
  await click(page, '() => window.__hl.menuHide'); await page.waitForTimeout(300);
  L.check('hide annotations button hides them', await page.evaluate(() => window.__hl.annotationsHidden === true));
  await click(page, '() => window.__hl.menuHide'); await page.waitForTimeout(300);
  L.check('and shows them again', await page.evaluate(() => window.__hl.annotationsHidden === false));
  // move
  const box = await page.evaluate(() => { const r = window.__hl.menuEl.firstChild.getBoundingClientRect(); return [r.left + r.width / 2, r.top + 4]; });
  await page.mouse.move(box[0], box[1]); await page.mouse.down(); await page.mouse.move(box[0] + 200, box[1] + 100, { steps: 5 }); await page.mouse.up();
  s = await state(page);
  L.check('dragging the header moves it, and it is saved', s.rect.left > 150 && await page.evaluate(() => !!JSON.parse(window.__gm['rnh:settings']).menuPos), s.rect);
  const store = await page.evaluate(() => window.__gm);
  await ctx.close();
  ({ ctx, page } = await L.open(browser, { html: HTML, menu: true, store, siteOff: true, url: 'https://example.test/next' }));
  s = await state(page);
  L.check('next visit: on, tools remembered, place kept', s.master === 'true' && s.rows.toolbar === 'false' && s.rows.keys === 'true' && s.rect.left > 150, s);
  // master off keeps the annotation visible? the script is off: annotations go with it
  await click(page, '() => window.__hl.menuMaster'); await page.waitForTimeout(300);
  L.check('master off: script stops, menu stays', !(await page.evaluate(() => window.__hl.running)) && (await state(page)).shown);
  await click(page, '() => window.__hl.menuMaster'); await page.waitForTimeout(300);
  await click(page, '() => window.__hl.menuClose'); await page.waitForTimeout(300);
  L.check('close hides the menu on this site', !(await state(page)).shown);
  await L.altKey(page, 'm', true); await page.waitForTimeout(300);
  L.check('Alt+Shift+M brings it back', (await state(page)).shown);
  await ctx.close(); await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
