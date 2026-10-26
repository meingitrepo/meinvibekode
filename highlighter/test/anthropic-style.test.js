// Anthropic style (DESIGN.md): parchment surfaces, serif for text and sans for chrome, flat (no shadows,
// hairline borders), filled buttons round only their bottom corners, clay only on the one primary action.
const L = require('./lib');
const HTML = `<!doctype html><html><body style="font: 16px/1.5 sans-serif; margin: 40px">
<p id="p1">Alpha beta gamma delta epsilon zeta eta theta iota kappa.</p></body></html>`;
const store = { 'https://example.test/a': JSON.stringify([
  { xpath: '//*[@id="p1"]', startOffset: 6, length: 4, key: 'h', text: 'beta', prefix: 'Alpha ', suffix: ' gamma', group: 'mg0abcde00001' }
]) };
const SLATE = 'rgb(20, 20, 19)', IVORY = 'rgb(250, 249, 245)', STONE = 'rgb(204, 203, 200)', CLAY = 'rgb(217, 119, 87)';
(async () => {
  const browser = await L.launch();
  for (const scheme of ['light', 'dark']) {
    const html = scheme === 'dark' ? HTML.replace('<body style="', '<body style="background:#121212;color:#e8e8e8;') : HTML;
    const { ctx, page } = await L.open(browser, { html, store, scheme });
    await page.evaluate(() => { window.__hl.showToast('Hello'); window.__hl.openPanel(); });
    await page.waitForTimeout(300);
    const css = (get, props) => page.evaluate(([get, props]) => { const s = getComputedStyle(eval(get)); return Object.assign({}, ...props.map(p => ({ [p]: s[p] }))); }, [get, props]);
    const surfaces = [['toolbar', 'window.__hl.toolbarEl'], ['card', 'window.__hl.noteCardEl'], ['editor', 'window.__hl.editorEl'], ['panel', 'window.__hl.panelEl'], ['toast', 'window.__hl.toastEl']];
    for (const [name, get] of surfaces) {
      const s = await css(get, ['backgroundColor', 'color', 'boxShadow', 'borderTopColor', 'borderTopWidth', 'fontFamily']);
      L.check(`${scheme} ${name}: flat, no shadow`, s.boxShadow === 'none', s);
      L.check(`${scheme} ${name}: ${scheme === 'light' ? 'ivory surface, slate text' : 'slate surface, ivory text'}`,
        s.backgroundColor === (scheme === 'light' ? IVORY : SLATE) && s.color === (scheme === 'light' ? SLATE : IVORY), s);
      L.check(`${scheme} ${name}: chrome is sans`, /Inter/.test(s.fontFamily) && !/Georgia/.test(s.fontFamily), s);
    }
    const light = await css('window.__hl.panelEl', ['borderTopColor', 'borderTopWidth']);
    L.check(`${scheme} panel: 1px hairline border`, light.borderTopWidth === '1px' && (scheme === 'dark' || light.borderTopColor === STONE), light);
    const text = await css('window.__hl.panelList', ['fontFamily']);
    const note = await page.evaluate(() => { const t = document.createElement('div'); t.className = 'card-text'; window.__hl.panelList.appendChild(t); const f = getComputedStyle(t).fontFamily; t.remove(); return f; });
    L.check(`${scheme}: note text is serif`, /Georgia/.test(note), note);
    L.check(`${scheme}: panel list inherits sans chrome`, /Inter/.test(text.fontFamily), text);
    // Save: clay and bottom-only rounded when it can act, quiet when there is nothing to save.
    const save = await page.evaluate(() => { const b = window.__hl.editorEl.querySelector('.btn-primary'); if (!b) return { bg: 'missing', radius: 'missing', offBg: 'missing' }; const on = (b.disabled = false, getComputedStyle(b)); const r = { bg: on.backgroundColor, radius: on.borderRadius }; b.disabled = true; const off = getComputedStyle(b); r.offBg = off.backgroundColor; return r; });
    L.check(`${scheme}: enabled Save is clay with bottom-only 8px corners`, save.bg === CLAY && save.radius === '0px 0px 8px 8px', save);
    L.check(`${scheme}: disabled Save is not clay`, save.offBg !== CLAY, save);
    // Clay is used nowhere else.
    const clayElsewhere = await page.evaluate(CLAY => [...window.__hl.panelEl.querySelectorAll('*'), ...window.__hl.toolbarEl.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return s.backgroundColor === CLAY || s.borderTopColor === CLAY || s.color === CLAY; }).length, CLAY);
    L.check(`${scheme}: clay not used in panel or toolbar`, clayElsewhere === 0, clayElsewhere);
    // 9.2: placeholder and secondary text meet WCAG AA (4.5:1) on the surface.
    const lum = c => { const v = c.match(/\d+/g).slice(0, 3).map(n => n / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const ratio = (a, b) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
    const ph = await page.evaluate(() => { const f = window.__hl.panelEl.querySelector('.field input'), t = document.createElement('div'); t.className = 'section-title'; window.__hl.panelList.appendChild(t);
      const r = { placeholder: getComputedStyle(f, '::placeholder').color, secondary: getComputedStyle(t).color, bg: getComputedStyle(window.__hl.panelEl).backgroundColor }; t.remove(); return r; });
    L.check(`${scheme}: placeholder text is at least 4.5:1`, ratio(ph.placeholder, ph.bg) >= 4.5, { ...ph, ratio: ratio(ph.placeholder, ph.bg).toFixed(2) });
    L.check(`${scheme}: secondary text is at least 4.5:1`, ratio(ph.secondary, ph.bg) >= 4.5, { ...ph, ratio: ratio(ph.secondary, ph.bg).toFixed(2) });
    // Checked checkbox follows slate (ivory in dark), not clay.
    const cb = await page.evaluate(() => { const c = document.createElement('input'); c.type = 'checkbox'; c.className = 'check'; c.checked = true; window.__hl.panelList.appendChild(c); const bg = getComputedStyle(c).backgroundColor; c.remove(); return bg; });
    L.check(`${scheme}: checked checkbox is ${scheme === 'light' ? 'slate' : 'ivory'}`, cb === (scheme === 'light' ? SLATE : IVORY), cb);
    await ctx.close();
  }
  // Links in notes: slate, underline always.
  const { ctx, page } = await L.open(browser, { html: HTML, store });
  const link = await page.evaluate(async () => { await window.__hl.openPanel(); const t = document.createElement('div'); t.className = 'card-text'; const a = document.createElement('a'); a.href = '#'; a.textContent = 'x'; t.appendChild(a); window.__hl.panelList.appendChild(t); const s = getComputedStyle(a); return { color: s.color, deco: s.textDecorationLine }; });
  L.check('note link: slate with a persistent underline', link.color === SLATE && link.deco === 'underline', link);
  // Fonts: sans/serif stacks come from the shadow root, no network font loading.
  const built = require('fs').readFileSync(require('path').join(__dirname, '..', 'Highlighter.user.js'), 'utf8');
  L.check('no remote font loading', !/fonts\.googleapis|@import url|@font-face/.test(built));
  L.check('no Fluent shadow tokens remain', !/--shadow(8|16|64)\s*:/.test(built));
  // 9.2: tokens have semantic Anthropic names (--ink, --surface, --line, --accent…), not Fluent ones.
  const fluentTokens = built.match(/--(color[A-Z]|borderRadius|duration[A-Z]|toolbarDivider)[A-Za-z0-9]*/g) || [];
  L.check('no Fluent-named tokens remain', !fluentTokens.length, [...new Set(fluentTokens)].slice(0, 8));
  // 9.2: Anthropic motion: short ease-out fades; no Fluent decelerate/accelerate curves, surfaces don't slide in.
  L.check('no Fluent motion curves remain', !/curve(Decelerate|Accelerate|EasyEase)|cubic-bezier\((0\.1, 0\.9|0\.9, 0\.1|0, 0, 0, 1|1, 0, 1, 1)/.test(built));
  L.check('surfaces fade in without sliding', !/@keyframes highlighter-enter \{[^}]*translate/.test(built) && !/\[hidden\] \{[^}]*translateY/.test(built));
  await ctx.close(); await L.done(browser);
})();
