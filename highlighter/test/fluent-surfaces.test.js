// Fluent v9 audit 13, 18, 22, 9, 10, 25: surfaces follow Fluent's own radius, shadow, width and padding.
const L = require('./lib');
const HTML = `<!doctype html><html><body style="font: 16px/1.5 sans-serif; margin: 40px">
<p id="p1">Alpha beta gamma delta epsilon zeta eta theta iota kappa.</p></body></html>`;
const SHADOW8 = /0px 4px 8px/, SHADOW16 = /0px 8px 16px/, SHADOW64 = /0px 32px 64px/;
(async () => {
  const browser = await L.launch();
  const store = { 'https://example.test/a': JSON.stringify([
    { xpath: '//*[@id="p1"]', startOffset: 6, length: 4, key: 'h', text: 'beta', prefix: 'Alpha ', suffix: ' gamma', group: 'mg0abcde00001' }
  ]) };
  const { ctx, page } = await L.open(browser, { html: HTML, store });
  const css = (get, props) => page.evaluate(([get, props]) => { const el = eval(get); const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return Object.assign({ w: Math.round(r.width) }, ...props.map(p => ({ [p]: s[p] }))); }, [get, props]);

  await page.evaluate(() => window.__hl.showToast('A toast title that is long enough to wrap onto a second line when the toast is narrow, to test the width')); await page.waitForTimeout(300);
  // 13: toast
  const toast = await css('window.__hl.toastEl', ['borderTopLeftRadius', 'right', 'bottom']);
  L.check('13: toast radius 4px (Fluent Toast)', toast.borderTopLeftRadius === '4px', toast);
  L.check('13: toast width 292px (Fluent Toaster)', toast.w === 292, toast);
  L.check('13: toast offset 16px from the corner', toast.right === '16px' && toast.bottom === '16px', toast);
  // 18: note card, note editor, annotations panel
  for (const [name, get] of [['card', 'window.__hl.noteCardEl'], ['editor', 'window.__hl.editorEl'], ['panel', 'window.__hl.panelEl']]) {
    const s = await css(get, ['borderTopLeftRadius', 'boxShadow']);
    L.check(`18: ${name} radius 4px (Fluent Popover)`, s.borderTopLeftRadius === '4px', s);
    L.check(`18: ${name} has a 16px shadow`, SHADOW16.test(s.boxShadow) || (name === 'panel' && SHADOW64.test(s.boxShadow)), s);
  }
  // 22: Alt+Shift+O dialog and the panel (Fluent Dialog / Drawer)
  await page.evaluate(() => window.__hl.openPanel()); await page.waitForTimeout(300);
  const panel = await css('window.__hl.panelEl', ['boxShadow']);
  const ptitle = await css('window.__hl.panelCount', ['fontSize', 'lineHeight']);
  L.check('22: panel is 320px wide with a shadow64', panel.w === 320 && SHADOW64.test(panel.boxShadow), panel);
  L.check('22: panel title stays 14/20', ptitle.fontSize === '14px' && ptitle.lineHeight === '20px', ptitle);
  await page.evaluate(() => window.__hl.closePanel());
  await page.keyboard.press('Alt+Shift+O'); await page.waitForTimeout(400);
  const box = await css('window.__hl.everythingEl.firstElementChild', ['boxShadow', 'paddingTop', 'borderTopLeftRadius']);
  const etitle = await css('window.__hl.everythingCount', ['fontSize', 'lineHeight']);
  const left = await page.evaluate(() => { const r = window.__hl; const b = r.everythingEl.firstElementChild.getBoundingClientRect(); return { count: r.everythingCount.getBoundingClientRect().left - b.left, field: r.everythingFilter.parentElement.getBoundingClientRect().left - b.left }; });
  L.check('22: dialog is 600px wide with a shadow64 and 8px corners', box.w === 600 && SHADOW64.test(box.boxShadow) && box.borderTopLeftRadius === '8px', box);
  L.check('22: dialog padding is 24px', box.paddingTop === '24px' || left.count === 24 && left.field === 24, { box, left });
  L.check('22: dialog title stays 14/20', etitle.fontSize === '14px' && etitle.lineHeight === '20px', etitle);
  // Shadow tokens equal Fluent tokens (createShadowTokens: ambient/key .12/.14 light, .24/.28 dark)
  const built = require('fs').readFileSync(require('path').join(__dirname, '..', 'Highlighter.user.js'), 'utf8');
  L.check('shadow64 light is 0 0 8px .12, 0 32px 64px .14', built.includes('--shadow64: 0 0 8px rgba(0, 0, 0, 0.12), 0 32px 64px rgba(0, 0, 0, 0.14)'));
  L.check('shadow64 dark is 0 0 8px .24, 0 32px 64px .28', built.includes('--shadow64: 0 0 8px rgba(0, 0, 0, 0.24), 0 32px 64px rgba(0, 0, 0, 0.28)'));
  // 25: pages are tree items, annotations their children
  const tree = await page.evaluate(() => { const r = window.__hl; let head = r.everythingList.querySelector('.page-head'); head.click(); head = r.everythingList.querySelector('.page-head'); const page = head.closest('.page');
    const item = r.everythingList.querySelector('.item');
    return { list: r.everythingList.getAttribute('role'), page: page.getAttribute('role'), head: [head.getAttribute('role'), head.getAttribute('aria-level'), head.getAttribute('aria-expanded')], group: r.everythingList.querySelector('.page-items')?.getAttribute('role'), item: [item?.getAttribute('role'), item?.getAttribute('aria-level')] }; });
  L.check('25: list is a tree', tree.list === 'tree', tree);
  L.check('25: page head is a level-1 treeitem with aria-expanded', tree.page === 'none' && tree.head[0] === 'treeitem' && tree.head[1] === '1' && tree.head[2] === 'true', tree);
  L.check('25: annotations are level-2 treeitems in a group', tree.group === 'group' && tree.item[0] === 'treeitem' && tree.item[1] === '2', tree);
  await page.keyboard.press('Escape');
  // 9, 10: toolbar padding, pen label
  const tb = await page.evaluate(() => { const r = window.__hl; const c = e => getComputedStyle(e); return { toolbar: c(r.toolbarEl).padding, pen: c(r.penEl).padding }; });
  L.check('9: toolbar and pen bar padding 4px 8px (Fluent medium)', tb.toolbar === '4px 8px' && tb.pen === '4px 8px', tb);
  await page.evaluate(() => { window.__hl.everythingClose.click(); });
  await L.altKey(page, 'p'); await page.waitForTimeout(300);
  const pen = await page.evaluate(() => { const t = window.__hl.penText; const r = t.getBoundingClientRect(); const c = getComputedStyle(t); return { text: t.textContent, w: Math.round(r.width), h: Math.round(r.height), visible: c.clipPath === 'none' && c.position !== 'absolute', fs: c.fontSize }; });
  L.check('10: the pen bar shows its label', /^Pen: /.test(pen.text) && pen.visible && pen.w > 40 && pen.h >= 16, pen);
  await ctx.close(); await L.done(browser);
})();
