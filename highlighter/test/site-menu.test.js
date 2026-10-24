// 9.1: the sticky menu: the site switch on top, then one column of icon buttons that expand from it.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px">
<p id="p1">Light paragraph one with words to select and more words after them.</p></body></html>`;
const btn = (page, id) => page.evaluate(i => window.__hl.menuButtons.get(i).click(), id);
const state = page => page.evaluate(() => ({
  shown: !window.__hl.menuEl.hidden && getComputedStyle(window.__hl.menuEl).display !== 'none',
  master: window.__hl.menuMaster.getAttribute('aria-pressed'),
  masterIsIconButton: window.__hl.menuMaster.tagName === 'BUTTON' && /btn-icon/.test(window.__hl.menuMaster.className) && !!window.__hl.menuMaster.querySelector('svg') && !window.__hl.menuMaster.hasAttribute('role'),
  masterLeft: Math.round(window.__hl.menuMaster.getBoundingClientRect().left), masterTop: Math.round(window.__hl.menuMaster.getBoundingClientRect().top),
  open: window.__hl.menuEl.hasAttribute('data-open'),
  ids: [...window.__hl.menuButtons.keys()].join(),
  pressed: Object.fromEntries([...window.__hl.menuButtons].map(([k, v]) => [k, v.getAttribute('aria-pressed')])),
  disabled: Object.fromEntries([...window.__hl.menuButtons].map(([k, v]) => [k, v.disabled])),
  lefts: [...window.__hl.menuButtons.values()].map(v => Math.round(v.getBoundingClientRect().left)),
  tops: [...window.__hl.menuButtons.values()].map(v => Math.round(v.getBoundingClientRect().top)),
  labels: [...window.__hl.menuButtons.values()].map(v => v.getAttribute('aria-label')),
  rect: JSON.parse(JSON.stringify(window.__hl.menuEl.getBoundingClientRect()))
}));
(async () => {
  const browser = await L.launch();
  let { ctx, page } = await L.open(browser, { html: HTML, menu: true, siteOff: true });
  let s = await state(page);
  L.check('menu shows on a site that is off, collapsed', s.shown && s.master === 'false' && !s.open, s);
  L.check('default corner is top left', s.rect.left < 20 && s.rect.top < 20, s.rect);
  L.check('buttons are undo, redo, panel, search, hide, pen, toolbar, keys', s.ids === 'undo,redo,panel,search,hide,pen,toolbar,keys', s.ids);
  L.check('one column: same left, increasing tops', new Set(s.lefts).size === 1 && s.tops.every((t, i) => !i || t > s.tops[i - 1]), s);
  L.check('the site switch is an icon button in the same column, above the rest', s.masterIsIconButton && s.masterLeft === s.lefts[0] && s.masterTop < s.tops[0], s);
  L.check('every button has a name with its shortcut', s.labels.every(l => /\(Alt\+/.test(l)), s.labels);
  await page.evaluate(() => window.__hl.menuMaster.click()); await page.waitForTimeout(400);
  s = await state(page);
  L.check('master on: script runs, column expands', await page.evaluate(() => window.__hl.running) && s.master === 'true' && s.open, s);
  L.check('undo and redo are disabled with nothing to undo', s.disabled.undo && s.disabled.redo, s.disabled);
  L.check('toolbar and shortcuts show pressed (on)', s.pressed.toolbar === 'true' && s.pressed.keys === 'true', s.pressed);
  await L.selStr(page, '#p1', 'words to select'); await L.altKey(page, 'h'); await page.waitForTimeout(300);
  await page.hover('body'); await page.evaluate(() => window.__hl.menuEl.dispatchEvent(new Event('pointerenter')));
  s = await state(page);
  L.check('after a highlight, undo is enabled', !s.disabled.undo && s.disabled.redo, s.disabled);
  await btn(page, 'undo'); await page.waitForTimeout(300);
  L.check('undo button undoes', (await L.stored(page)).length === 0);
  await btn(page, 'redo'); await page.waitForTimeout(300);
  L.check('redo button redoes', (await L.stored(page)).length === 1);
  await btn(page, 'panel'); await page.waitForTimeout(300);
  L.check('panel button opens Alt+O panel', await page.evaluate(() => !window.__hl.panelEl.hidden));
  await btn(page, 'panel'); await page.waitForTimeout(300);
  L.check('and closes it', await page.evaluate(() => window.__hl.panelEl.hidden));
  await btn(page, 'search'); await page.waitForTimeout(300);
  L.check('search button opens Alt+Shift+O', await page.evaluate(() => !window.__hl.everythingEl.hidden));
  await btn(page, 'search'); await page.waitForTimeout(300);
  await btn(page, 'hide'); await page.waitForTimeout(200);
  L.check('hide button hides the annotations', await page.evaluate(() => window.__hl.annotationsHidden === true));
  await btn(page, 'hide'); await page.waitForTimeout(200);
  L.check('and shows them again', await page.evaluate(() => window.__hl.annotationsHidden === false));
  await btn(page, 'pen'); await page.waitForTimeout(300);
  L.check('pen button turns the pen on', await page.evaluate(() => window.__hl.penKey !== null));
  await btn(page, 'pen'); await page.waitForTimeout(300);
  L.check('and off', await page.evaluate(() => window.__hl.penKey === null));
  await btn(page, 'toolbar'); await page.waitForTimeout(200);
  L.check('toolbar button switches the selection toolbar off', await page.evaluate(() => JSON.parse(window.__gm['rnh:settings']).toolbarOff === true));
  await btn(page, 'toolbar');
  await btn(page, 'keys'); await page.waitForTimeout(200);
  L.check('shortcuts button switches shortcuts off', await page.evaluate(() => JSON.parse(window.__gm['rnh:settings']).keysOff === true));
  await btn(page, 'keys');
  const box = await page.evaluate(() => { const r = window.__hl.menuEl.getBoundingClientRect(); return [r.left + 3, r.top + 3]; });
  await page.mouse.move(box[0], box[1]); await page.mouse.down(); await page.mouse.move(box[0] + 200, box[1] + 100, { steps: 5 }); await page.mouse.up();
  s = await state(page);
  L.check('dragging the menu moves it, and it is saved', s.rect.left > 150 && await page.evaluate(() => !!JSON.parse(window.__gm['rnh:settings']).menuPos), s.rect);
  const store = await page.evaluate(() => window.__gm);
  await ctx.close();
  ({ ctx, page } = await L.open(browser, { html: HTML, menu: true, store, siteOff: true, url: 'https://example.test/next' }));
  s = await state(page);
  L.check('next visit: on, place kept', s.master === 'true' && s.rect.left > 150, s);
  await page.evaluate(() => window.__hl.menuMaster.click()); await page.waitForTimeout(300);
  L.check('master off: script stops, menu stays', !(await page.evaluate(() => window.__hl.running)) && (await state(page)).shown);
  await page.evaluate(() => window.__hl.menuMaster.click()); await page.waitForTimeout(300);
  await page.evaluate(() => window.__hl.menuClose.click()); await page.waitForTimeout(300);
  L.check('close hides the menu on this site', !(await state(page)).shown);
  await L.altKey(page, 'm', true); await page.waitForTimeout(300);
  L.check('Alt+Shift+M brings it back', (await state(page)).shown);
  await ctx.close(); await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
