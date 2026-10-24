// Fluent v9 audit 18, 22, 9, 10, 25: surfaces follow Fluent's own radius, shadow, width and padding.
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

  await page.evaluate(() => window.__hl.showToast('Hello', { body: 'Builds the on-page UI.' })); await page.waitForTimeout(300);
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
  L.check('22: panel title is 20/28', ptitle.fontSize === '20px' && ptitle.lineHeight === '28px', ptitle);
  await page.evaluate(() => window.__hl.closePanel());
  await page.keyboard.press('Alt+Shift+O'); await page.waitForTimeout(400);
  const box = await css('window.__hl.everythingEl.firstElementChild', ['boxShadow', 'paddingTop', 'borderTopLeftRadius']);
  const etitle = await css('window.__hl.everythingCount', ['fontSize', 'lineHeight']);
  const left = await page.evaluate(() => { const r = window.__hl; const b = r.everythingEl.firstElementChild.getBoundingClientRect(); return { count: r.everythingCount.getBoundingClientRect().left - b.left, field: r.everythingFilter.parentElement.getBoundingClientRect().left - b.left }; });
  L.check('22: dialog is 600px wide with a shadow64 and 8px corners', box.w === 600 && SHADOW64.test(box.boxShadow) && box.borderTopLeftRadius === '8px', box);
  L.check('22: dialog padding is 24px', box.paddingTop === '24px' || left.count === 24 && left.field === 24, { box, left });
  L.check('22: dialog title is 20/28', etitle.fontSize === '20px' && etitle.lineHeight === '28px', etitle);
  await page.keyboard.press('Escape');
  await ctx.close(); await L.done(browser);
})();
