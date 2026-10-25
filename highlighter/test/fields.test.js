// Audit task 9: note textarea and search field (pressed and focus borders, icon gap).
const L = require('./lib');
const HTML = `<!doctype html><html><body style="font: 16px/1.5 sans-serif; margin: 40px"><p id="p1">Alpha beta gamma delta.</p></body></html>`;
(async () => {
  const browser = await L.launch();
  const { ctx, page } = await L.open(browser, { html: HTML, store: {} });
  await page.evaluate(() => window.__hl.openPanel());
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => {
    const root = window.__hl.panelEl.getRootNode();
    const rules = Array.from(root.styleSheets || []).concat(root.adoptedStyleSheets || []).flatMap(s => Array.from(s.cssRules)).map(x => x.cssText).join('\n');
    const icon = window.__hl.panelEl.querySelector('.search-icon'), input = window.__hl.panelEl.querySelector('.field input');
    const ib = icon.getBoundingClientRect(), fb = input.parentElement.getBoundingClientRect();
    return { rules, left: ib.left - fb.left, gap: input.getBoundingClientRect().left + parseFloat(getComputedStyle(input).paddingLeft) - ib.right };
  });
  const has = re => re.test(r.rules);
  L.check('--colorNeutralStroke1Pressed token exists', has(/--colorNeutralStroke1Pressed:/));
  L.check('active and focus-within use Stroke1Pressed', has(/\.field:(active|focus-within)[^{]*\{[^}]*border-color: var\(--colorNeutralStroke1Pressed\)/));
  L.check('bottom line goes to StrokeAccessiblePressed', has(/\.field:(active|focus-within)::before\s*\{[^}]*colorNeutralStrokeAccessiblePressed/));
  L.check('focus bar pressed is CompoundBrandStrokePressed', has(/\.field:active::after\s*\{[^}]*colorCompoundBrandStrokePressed/));
  L.check('search icon sits 10px from the field edge', Math.abs(r.left - 10) < 0.6, r.left);
  L.check('4px gap between icon and text', Math.abs(r.gap - 4) < 0.6, r.gap);
  await ctx.close(); await L.done(browser);
})();
