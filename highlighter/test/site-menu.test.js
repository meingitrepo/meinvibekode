// 9.2: the sticky menu: a handle, one expand button, then one column of icon buttons. The script always runs;
// the toolbar and the shortcuts are per site and off until switched on.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"></head><body style="font:16px sans-serif;margin:200px 40px">
<p id="p1">Light paragraph one with words to select and more words after them.</p></body></html>`;
const btn = (page, id) => page.evaluate(i => window.__hl.menuButtons.get(i).click(), id);
const rectOf = (page, name) => page.evaluate(n => JSON.parse(JSON.stringify(window.__hl[n].getBoundingClientRect())), name);
const state = page => page.evaluate(() => ({
  shown: !window.__hl.menuEl.hidden && getComputedStyle(window.__hl.menuEl).display !== 'none',
  expanded: window.__hl.menuExpand.getAttribute('aria-expanded'),
  expandIsIconButton: window.__hl.menuExpand.tagName === 'BUTTON' && /btn-icon/.test(window.__hl.menuExpand.className) && !!window.__hl.menuExpand.querySelector('svg'),
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
  let { ctx, page } = await L.open(browser, { html: HTML, menu: true, defaults: true });
  let s = await state(page);
  L.check('the script runs on a fresh site; the menu is one button', await page.evaluate(() => window.__hl.running) && s.shown && s.expanded === 'false' && !s.open, s);
  L.check('default corner is top left', s.rect.left < 20 && s.rect.top < 20, s.rect);
  L.check('buttons are pen, toolbar, keys, undo, redo, panel, search, hide', s.ids === 'pen,toolbar,keys,undo,redo,panel,search,hide', s.ids);
  L.check('no power button any more', await page.evaluate(() => !window.__hl.menuEl.querySelector('[aria-label^="Turn highlighter"]')));
  const hr = await rectOf(page, 'menuHandle'), er = await rectOf(page, 'menuExpand');
  L.check('the handle is on top, then the expand icon button', s.expandIsIconButton && hr.bottom <= er.top + 1 && hr.top < er.top, { hr, er });
  L.check('every button has a name with its shortcut', s.labels.every(l => /\(Alt\+/.test(l)), s.labels);
  L.check('fresh site: toolbar and shortcuts show off', s.pressed.toolbar === 'false' && s.pressed.keys === 'false', s.pressed);
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(400);
  const noToolbar = !(await L.toolbar(page));
  await L.altKey(page, 'h'); await page.waitForTimeout(300);
  L.check('fresh site: no toolbar, and shortcuts do nothing', noToolbar && (await L.stored(page)).length === 0);
  await page.evaluate(() => window.__hl.menuExpand.click()); await page.waitForTimeout(400);
  s = await state(page);
  L.check('expand opens the column', s.expanded === 'true' && s.open, s);
  L.check('one column: same left, increasing tops', new Set(s.lefts).size === 1 && s.tops.every((t, i) => !i || t > s.tops[i - 1]), s);
  L.check('undo and redo are disabled with nothing to undo', s.disabled.undo && s.disabled.redo, s.disabled);
  await btn(page, 'keys'); await btn(page, 'toolbar'); await page.waitForTimeout(200);
  s = await state(page);
  L.check('keys and toolbar buttons switch this site on, shown pressed', s.pressed.toolbar === 'true' && s.pressed.keys === 'true' && await page.evaluate(() => { const c = JSON.parse(window.__gm['rnh:settings']); return c.toolbarOnSites.includes('example.test') && c.keysOnSites.includes('example.test'); }), s.pressed);
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
  L.check('toolbar button switches this site off again', await page.evaluate(() => !JSON.parse(window.__gm['rnh:settings']).toolbarOnSites.includes('example.test')));
  const hb = await rectOf(page, 'menuHandle');
  await page.mouse.move(hb.left + hb.width / 2, hb.top + hb.height / 2); await page.mouse.down(); await page.mouse.move(hb.left + 200, hb.top + 100, { steps: 5 }); await page.mouse.up();
  s = await state(page);
  L.check('dragging the handle moves the menu, and it is saved', s.rect.left > 150 && await page.evaluate(() => !!JSON.parse(window.__gm['rnh:settings']).menuPos), s.rect);
  await page.evaluate(() => window.__hl.menuExpand.click()); await page.waitForTimeout(300);
  L.check('expand again collapses it', (await state(page)).expanded === 'false');
  await page.evaluate(() => window.__hl.menuExpand.click()); await page.waitForTimeout(300);
  const store = await page.evaluate(() => window.__gm);
  await ctx.close();
  ({ ctx, page } = await L.open(browser, { html: HTML, menu: true, store, url: 'https://example.test/next' }));
  s = await state(page);
  L.check('next visit: collapsed again, place kept', s.expanded === 'false' && !s.open && s.rect.left > 150, s);
  await page.evaluate(() => window.__hl.menuClose.click()); await page.waitForTimeout(300);
  L.check('close hides the menu on this site', !(await state(page)).shown);
  await L.altKey(page, 'm', true); await page.waitForTimeout(300);
  L.check('Alt+Shift+M brings it back', (await state(page)).shown);
  await ctx.close(); await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
