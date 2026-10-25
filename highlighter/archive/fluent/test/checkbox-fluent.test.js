const L = require('./lib');
const HTML = `<!doctype html><html><body style="font: 16px/1.5 sans-serif; margin: 40px">
<p id="p1">Alpha beta gamma delta epsilon zeta eta theta iota kappa.</p></body></html>`;
(async () => {
  const browser = await L.launch();
  const store = { 'https://example.test/a': JSON.stringify([
    { xpath: '//*[@id="p1"]', startOffset: 6, length: 4, key: 'h', text: 'beta', prefix: 'Alpha ', suffix: ' gamma', group: 'mg0abcde00001' }
  ]) };
  const { ctx, page } = await L.open(browser, { html: HTML, store });
  await page.evaluate(() => window.__hl.openPanel());
  await page.waitForTimeout(300);
  // Paints a fresh checkbox in each state and reads Fluent's tokens off it.
  const st = await page.evaluate(() => {
    const host = window.__hl.panelList, out = {};
    const mk = f => { const c = document.createElement('input'); c.type = 'checkbox'; c.className = 'check'; f(c); host.appendChild(c); return c; };
    const cs = (c, p) => getComputedStyle(c, p);
    const un = mk(() => {}), on = mk(c => { c.checked = true; }), mix = mk(c => { c.indeterminate = true; }), dis = mk(c => { c.disabled = true; });
    out.radius = cs(un).borderTopLeftRadius;
    out.size = cs(un).width + 'x' + cs(un).height;
    out.onBg = cs(on).backgroundColor;
    out.mixBorder = cs(mix).borderTopColor;
    out.mixMark = cs(mix, '::after').backgroundColor;
    out.mixMask = cs(mix, '::after').webkitMaskImage || cs(mix, '::after').maskImage;
    out.disBorder = cs(dis).borderTopColor;
    out.disCursor = cs(dis).cursor;
    const root = host.getRootNode(), sheet = Array.from(root.styleSheets || []).concat(root.adoptedStyleSheets || []);
    const rules = sheet.flatMap(s => Array.from(s.cssRules)).map(r => r.cssText || '').join('\n');
    out.pressedUn = /\.check:active\s*\{[^}]*colorNeutralStrokeAccessiblePressed/.test(rules);
    out.pressedOn = /\.check:checked:active\s*\{[^}]*colorCompoundBrandBackgroundPressed/.test(rules);
    out.pressedMix = /\.check:indeterminate:active::after\s*\{[^}]*colorCompoundBrandForeground1Pressed/.test(rules);
    [un, on, mix, dis].forEach(c => c.remove());
    return out;
  });
  L.check('2px corners (borderRadiusSmall)', st.radius === '2px', st.radius);
  L.check('16px square', st.size === '16px x16px'.replace(' ', ''), st.size);
  L.check('checked is brand', st.onBg === 'rgb(15, 108, 189)', st.onBg);
  L.check('mixed: brand outline, brand Square12 mark', st.mixBorder === 'rgb(15, 108, 189)' && st.mixMark === 'rgb(15, 108, 189)' && /M2 4a2 2 0 0 1 2-2h4/.test(st.mixMask), st);
  L.check('disabled border is NeutralStrokeDisabled', st.disBorder === 'rgb(224, 224, 224)' && st.disCursor === 'default', st);
  L.check('pressed states for unchecked, checked, mixed', st.pressedUn && st.pressedOn && st.pressedMix, st);
  await ctx.close(); await L.done(browser);
})();
