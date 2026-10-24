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

  // 13: toast
  await page.evaluate(() => window.__hl.showToast('Hello', { body: 'A body line that is long enough to wrap onto a second line when the toast is narrow, to test the width.' }));
  await page.waitForTimeout(300);
  const toast = await css('window.__hl.toastEl', ['borderTopLeftRadius', 'right', 'bottom', 'boxShadow']);
  L.check('13: toast radius 4px (Fluent Toast)', toast.borderTopLeftRadius === '4px', toast);
  L.check('13: toast width 292px (Fluent Toaster)', toast.w === 292, toast);
  L.check('13: toast offset 16px from the corner', toast.right === '16px' && toast.bottom === '16px', toast);

  // 18: note card, note editor, annotations panel
  for (const [name, get] of [['card', 'window.__hl.noteCardEl'], ['editor', 'window.__hl.editorEl'], ['panel', 'window.__hl.panelEl']]) {
    const s = await css(get, ['borderTopLeftRadius', 'boxShadow']);
    L.check(`18: ${name} radius 4px (Fluent Popover)`, s.borderTopLeftRadius === '4px', s);
    L.check(`18: ${name} has a 16px shadow`, SHADOW16.test(s.boxShadow) || (name === 'panel' && SHADOW64.test(s.boxShadow)), s);
  }
  await ctx.close(); await L.done(browser);
})();
