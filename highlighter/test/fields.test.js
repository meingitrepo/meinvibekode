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
  // 9.2: Anthropic inputs: a plain 1px hairline on all four sides that darkens to slate on focus; no Fluent focus bar.
  const f = await page.evaluate(async () => {   // opening the panel focuses its filter, so blur first
    const field = window.__hl.panelEl.querySelector('.field'), input = field.querySelector('input');
    const look = () => { const s = getComputedStyle(field); return { w: [s.borderTopWidth, s.borderBottomWidth].join(), bottom: s.borderBottomColor, radius: s.borderRadius, bar: getComputedStyle(field, '::after').content, line: getComputedStyle(field, '::before').content }; };
    const settle = () => new Promise(r => setTimeout(r, 250));
    input.blur(); await settle(); const rest = look(); input.focus(); await settle(); const focus = look(); return { rest, focus };
  });
  L.check('field: 1px hairline on all sides, 4px corners', f.rest.w === '1px,1px' && f.rest.radius === '4px', f.rest);
  L.check('field: no Fluent focus bar or drawn bottom line', f.rest.bar === 'none' && f.rest.line === 'none', f.rest);
  L.check('field: border darkens to slate on focus', f.focus.bottom === 'rgb(20, 20, 19)' && f.rest.bottom !== f.focus.bottom, f);
  const ph = await page.evaluate(() => window.__hl.editorEl.querySelector('textarea').placeholder);
  L.check('note box placeholder says what to do', ph === 'Add a note', ph);
  L.check('search icon sits 10px from the field edge', Math.abs(r.left - 10) < 0.6, r.left);
  L.check('4px gap between icon and text', Math.abs(r.gap - 4) < 0.6, r.gap);
  await ctx.close(); await L.done(browser);
})();
