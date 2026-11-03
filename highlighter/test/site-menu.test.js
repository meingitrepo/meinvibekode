// 9.2: the sticky menu: a handle, one expand button, then one row of icon buttons. The script always runs;
// the shortcuts are per site and off until switched on.
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
  L.check('buttons are search, panel, pen, keys, hide (no undo or redo: deletion toasts carry the link)', s.ids === 'search,panel,pen,keys,hide', s.ids);
  const row = await page.evaluate(() => {
    const m = window.__hl.menuButtons, inner = m.get('hide').parentElement, names = new Map([...m].map(([k, v]) => [v, k]));
    const cs = getComputedStyle(inner.querySelector('[role="separator"]'));
    return { order: [...inner.children].map(c => names.get(c) || (c === window.__hl.penEl ? 'penbar' : '') || (c.getAttribute('role') === 'separator' && c.className === 'divider' ? '|' : '?')).join(' '), margin: [cs.marginLeft, cs.marginRight] };
  });
  L.check('dividers with their usual padding split the groups; the pen bar ends the row', row.order === 'search panel | pen keys hide | penbar' && row.margin[0] === '10px' && row.margin[1] === '10px', row);
  L.check('no power button any more', await page.evaluate(() => !window.__hl.menuEl.querySelector('[aria-label^="Turn highlighter"]')));
  const hr = await rectOf(page, 'menuHandle'), er = await rectOf(page, 'menuExpand');
  L.check('the handle is on the left, then the expand icon button', s.expandIsIconButton && hr.right <= er.left + 1 && hr.left < er.left, { hr, er });
  const mr = s.rect, gap = { top: er.top - mr.top, left: hr.left - mr.left, right: mr.right - er.right, bottom: mr.bottom - er.bottom };
  L.check('collapsed: the same small padding on every side, and a short menu', Math.max(...Object.values(gap)) - Math.min(...Object.values(gap)) <= 1 && gap.left <= 6 && mr.height <= 44, { gap, height: mr.height });
  const handleLook = () => page.evaluate(() => {
    const h = window.__hl.menuHandle, c = getComputedStyle(h), svg = h.querySelector('svg'), s = svg && getComputedStyle(svg);
    const probe = (bg) => { const d = document.createElement('div'); d.style.background = bg; h.parentNode.appendChild(d); const v = getComputedStyle(d).backgroundColor; d.remove(); return v; };
    return { width: c.width, bg: c.backgroundColor, transition: c.transition, icon: !!svg && svg.getAttribute('class'), size: s && s.width, fill: s && s.fill, dots: svg ? (svg.querySelector('path').getAttribute('d').match(/Z/g) || []).length : 0, before: getComputedStyle(h, '::before').content,
      ink: probe('var(--ink)'), ink2: probe('var(--ink-2)'), hover: probe('var(--surface-hover)'), canvasText: probe('CanvasText') };
  });
  let hl = await handleLook();
  L.check('the handle is a six-dot grip icon coloured like the buttons, in a narrow slot', hl.dots === 6 && hl.size === '20px' && hl.width === '14px' && hl.fill === hl.ink2 && hl.before === 'none', hl);
  L.check('the handle has no transition: it has no hover or pressed state', !/background-color|color/.test(hl.transition), hl.transition);
  const hdr = await rectOf(page, 'menuHandle'); await page.mouse.move(hdr.left + hdr.width / 2, hdr.top + hdr.height / 2); await page.waitForTimeout(300);
  hl = await handleLook();
  L.check('hovering the handle changes nothing', hl.bg !== hl.hover && hl.fill === hl.ink2, hl);
  await page.mouse.move(600, 600); await page.waitForTimeout(300);
  await page.emulateMedia({ forcedColors: 'active' }); await page.waitForTimeout(300);
  hl = await handleLook();
  L.check('forced colors: the grip is drawn in CanvasText', hl.fill === hl.canvasText, hl);
  await page.emulateMedia({ forcedColors: 'none' });
  L.check('every button has a name with its shortcut', s.labels.every(l => /\(Alt\+/.test(l)), s.labels);
  L.check('fresh site: shortcuts show off', s.pressed.keys === 'false', s.pressed);
  await L.selStr(page, '#p1', 'words to select'); await page.waitForTimeout(400);
  await L.altKey(page, 'h'); await page.waitForTimeout(300);
  L.check('fresh site: shortcuts do nothing', (await L.stored(page)).length === 0);
  await page.evaluate(() => window.__hl.menuExpand.click()); await page.waitForTimeout(400);
  s = await state(page);
  L.check('expand opens the row', s.expanded === 'true' && s.open, s);
  L.check('one row: same top, increasing lefts', new Set(s.tops).size === 1 && s.lefts.every((t, i) => !i || t > s.lefts[i - 1]), s);
  const openExpand = await rectOf(page, 'menuExpand');
  const openHandle = await rectOf(page, 'menuHandle');
  L.check('open: the collapse button stays beside the handle, 2px off it like the other buttons, before the row', openExpand.left - openHandle.right === 2 && openExpand.right <= s.lefts[0], { openHandle, openExpand, lefts: s.lefts });
  await btn(page, 'keys'); await page.waitForTimeout(200);
  s = await state(page);
  L.check('keys button switches this site on, shown pressed', s.pressed.keys === 'true' && await page.evaluate(() => JSON.parse(window.__gm['rnh:settings']).keysOnSites.includes('example.test')), s.pressed);
  await L.selStr(page, '#p1', 'words to select'); await L.altKey(page, 'h'); await page.waitForTimeout(300);
  await page.hover('body'); await page.evaluate(() => window.__hl.menuEl.dispatchEvent(new Event('pointerenter')));
  L.check('the highlight was made', (await L.stored(page)).length === 1);
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
  L.check('no "Hide the menu" button in the menu', await page.evaluate(() => !window.__hl.menuClose && ![...window.__hl.menuEl.querySelectorAll('button')].some(b => /Hide the menu/.test(b.getAttribute('aria-label') || ''))));
  await L.altKey(page, 'm', true); await page.waitForTimeout(300);
  L.check('Alt+Shift+M hides the menu on this site', !(await state(page)).shown);
  await L.altKey(page, 'm', true); await page.waitForTimeout(300);
  L.check('Alt+Shift+M brings it back', (await state(page)).shown);
  // Alt+Shift+M follows the same gates as the other keys: not in a field, not with the keys switched off.
  const keyM = () => page.evaluate(() => window.__keyMPrevented);
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'fld'; document.body.appendChild(i); window.addEventListener('keydown', e => { if (e.code === 'KeyM') window.__keyMPrevented = e.defaultPrevented; }, true); i.focus(); });
  await L.altKey(page, 'm', true); await page.waitForTimeout(300);
  L.check('Alt+Shift+M in a text field leaves the menu and the key alone', (await state(page)).shown && (await keyM()) === false, await keyM());
  await page.evaluate(() => document.getElementById('fld').blur());
  await L.altKey(page, 'k', true); await page.waitForTimeout(300);
  await L.altKey(page, 'm', true); await page.waitForTimeout(300);
  L.check('Alt+Shift+M does nothing while the shortcut keys are off', (await state(page)).shown);
  await L.altKey(page, 'k', true); await page.waitForTimeout(300);
  // A refused write: the menu stays where it was, and is not hidden as if it had been saved.
  const failWrites = on => page.evaluate(on => {
    if (!window.__origSet) window.__origSet = window.GM_setValue;
    window.GM_setValue = on ? () => { throw new Error('quota'); } : window.__origSet;
  }, on);
  await failWrites(true);
  await L.altKey(page, 'm', true); await page.waitForTimeout(300);
  L.check('a refused write does not hide the menu', (await state(page)).shown);
  const before = (await state(page)).rect;
  const hb2 = await rectOf(page, 'menuHandle');
  await page.mouse.move(hb2.left + hb2.width / 2, hb2.top + hb2.height / 2); await page.mouse.down(); await page.mouse.move(hb2.left - 60, hb2.top + 50, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(300);
  const after = (await state(page)).rect;
  L.check('a refused write puts a dragged menu back where it was saved', Math.abs(after.left - before.left) < 2 && Math.abs(after.top - before.top) < 2, { before, after });
  await failWrites(false);
  const theme = () => page.evaluate(() => window.__hl.menuEl.getRootNode().host.getAttribute('data-theme'));
  const lightTheme = await theme();
  await page.evaluate(() => { document.documentElement.style.background = '#111'; document.body.style.background = '#111'; document.body.style.color = '#eee'; document.documentElement.classList.add('dark'); });
  await page.waitForTimeout(2500);
  L.check('the page turns dark while the menu is idle: the menu follows', lightTheme === 'light' && await theme() === 'dark', { lightTheme, now: await theme() });
  await ctx.close(); await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
