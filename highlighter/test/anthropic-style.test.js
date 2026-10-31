// Anthropic style (DESIGN.md): parchment surfaces, serif for text and sans for chrome, flat (no shadows,
// hairline borders), buttons share one 8px radius, the primary action is inverted ink.
const L = require('./lib');
const HTML = `<!doctype html><html><body style="font: 16px/1.5 sans-serif; margin: 40px">
<p id="p1">Alpha beta gamma delta epsilon zeta eta theta iota kappa.</p></body></html>`;
const store = { 'https://example.test/a': JSON.stringify([
  { xpath: '//*[@id="p1"]', startOffset: 6, length: 4, key: 'h', text: 'beta', prefix: 'Alpha ', suffix: ' gamma', group: 'mg0abcde00001' }
]) };
const SLATE = 'rgb(20, 20, 19)', IVORY = 'rgb(250, 249, 245)', HAIRLINE = 'rgb(232, 230, 220)', CLAY = 'rgb(217, 119, 87)';
(async () => {
  const browser = await L.launch();
  for (const scheme of ['light', 'dark']) {
    const html = scheme === 'dark' ? HTML.replace('<body style="', '<body style="background:#121212;color:#e8e8e8;') : HTML;
    const { ctx, page } = await L.open(browser, { html, store, scheme });
    await page.evaluate(() => { window.__hl.showToast('Hello'); window.__hl.openPanel(); });
    await page.waitForTimeout(300);
    const css = (get, props) => page.evaluate(([get, props]) => { const s = getComputedStyle(eval(get)); return Object.assign({}, ...props.map(p => ({ [p]: s[p] }))); }, [get, props]);
    const surfaces = [['toolbar', 'window.__hl.toolbarEl'], ['card', 'window.__hl.noteCardEl'], ['editor', 'window.__hl.editorEl'], ['panel', 'window.__hl.panelEl'], ['toast', 'window.__hl.toastEl'], ['dialog', 'window.__hl.everythingEl.firstElementChild']];
    for (const [name, get] of surfaces) {
      const s = await css(get, ['backgroundColor', 'color', 'boxShadow', 'borderTopColor', 'borderTopWidth', 'fontFamily']);
      L.check(`${scheme} ${name}: flat, no shadow`, s.boxShadow === 'none', s);
      L.check(`${scheme} ${name}: ${scheme === 'light' ? 'ivory surface, slate text' : 'slate surface, ivory text'}`,
        s.backgroundColor === (scheme === 'light' ? IVORY : SLATE) && s.color === (scheme === 'light' ? SLATE : IVORY), s);
      L.check(`${scheme} ${name}: chrome is sans`, /^"Anthropic Sans", Poppins, Arial, sans-serif$/.test(s.fontFamily) && !/Georgia/.test(s.fontFamily), s);
    }
    const light = await css('window.__hl.panelEl', ['borderTopColor', 'borderTopWidth']);
    L.check(`${scheme} panel: 1px hairline border`, light.borderTopWidth === '1px' && (scheme === 'dark' || light.borderTopColor === HAIRLINE), light);
    const text = await css('window.__hl.panelList', ['fontFamily']);
    const note = await page.evaluate(() => { const t = document.createElement('div'); t.className = 'card-text'; window.__hl.panelList.appendChild(t); const f = getComputedStyle(t).fontFamily; t.remove(); return f; });
    L.check(`${scheme}: note text is serif`, /^"Anthropic Serif", Lora, Georgia/.test(note), note);
    L.check(`${scheme}: panel list inherits sans chrome`, /^"Anthropic Sans", Poppins/.test(text.fontFamily), text);
    // Save: clay and fully rounded (8px) when it can act, quiet when there is nothing to save.
    const save = await page.evaluate(() => { const b = window.__hl.editorEl.querySelector('.btn-primary'); if (!b) return { bg: 'missing', radius: 'missing', offBg: 'missing' }; const on = (b.disabled = false, getComputedStyle(b)); const r = { bg: on.backgroundColor, radius: on.borderRadius }; b.disabled = true; const off = getComputedStyle(b); r.offBg = off.backgroundColor; return r; });
    L.check(`${scheme}: enabled Save is ink-filled with 8px corners`, save.bg === (scheme === 'light' ? SLATE : IVORY) && save.radius === '8px', save);
    L.check(`${scheme}: disabled Save is not filled`, save.offBg !== (scheme === 'light' ? SLATE : IVORY), save);
    // Clay is used nowhere else.
    const clayElsewhere = await page.evaluate(CLAY => [...window.__hl.panelEl.querySelectorAll('*'), ...window.__hl.toolbarEl.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); return s.backgroundColor === CLAY || s.borderTopColor === CLAY || s.color === CLAY; }).length, CLAY);
    L.check(`${scheme}: clay not used in panel or toolbar`, clayElsewhere === 0, clayElsewhere);
    // Guideline: buttons weight 500, dialog titles serif 500, small UI text tracked +0.01em.
    const type = await page.evaluate(() => {
      const get = (cls, root) => { const t = document.createElement('div'); t.className = cls; root.appendChild(t); const c = getComputedStyle(t); const r = { w: c.fontWeight, ls: c.letterSpacing }; t.remove(); return r; };
      return { btn: get('btn', window.__hl.panelList).w, title: get('panel-title', window.__hl.panelEl), count: getComputedStyle(window.__hl.panelEl.querySelector('.panel-count')).fontFamily, meta: get('item-meta', window.__hl.panelList) };
    });
    L.check(`${scheme}: button text is weight 500`, type.btn === '500', type);
    L.check(`${scheme}: dialog title is serif, weight 500`, /^"Anthropic Serif"/.test(type.count) && type.title.w === '500', type);
    L.check(`${scheme}: small UI text has +0.01em tracking`, type.meta.ls === '0.12px', type);
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
  // Cards and dialogs: 16px corners. Dialog titles: body 16/24. A toast is a tooltip at the bottom centre: same padding, radius and type size.
  const look = (get, props) => page.evaluate(([get, props]) => { const s = getComputedStyle(eval(get)); return Object.assign({}, ...props.map(p => ({ [p]: s[p] }))); }, [get, props]);
  for (const [name, get] of [['card', 'window.__hl.noteCardEl'], ['editor', 'window.__hl.editorEl'], ['panel', 'window.__hl.panelEl'], ['dialog', 'window.__hl.everythingEl.firstElementChild']]) {
    const r = await look(get, ['borderTopLeftRadius']);
    L.check(`${name}: 16px corners`, r.borderTopLeftRadius === '16px', r);
  }
  for (const [name, get] of [['panel', 'window.__hl.panelCount'], ['dialog', 'window.__hl.everythingCount']]) {
    const t = await look(get, ['fontSize', 'lineHeight']);
    L.check(`${name} title: 16/24`, t.fontSize === '16px' && t.lineHeight === '24px', t);
  }
  const TIP = ['borderTopLeftRadius', 'padding', 'fontSize'];
  const toast = await look('window.__hl.toastEl', TIP), tip = await look('window.__hl.labelTipEl', TIP);
  L.check("toast has the tooltip's radius, padding and type size", JSON.stringify(toast) === JSON.stringify(tip), { toast, tip });
  // Fonts: sans/serif stacks come from the shadow root, no network font loading.
  const built = require('fs').readFileSync(require('path').join(__dirname, '..', 'Highlighter.user.js'), 'utf8');
  // Source rules: spacing on the 4px scale, keyboard focus on buttons is a 2px ring with a 2px gap.
  const SCALE = new Set([0, 1, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40]);
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'ui-style.js'), 'utf8').replace(/round\([^)]*\)|calc\([^)]*\)/g, '');
  const off = [];
  for (const m of css.matchAll(/(?:padding|margin|gap|top|left|right|bottom|height)[a-z-]*: ([^;{}]*)/g)) for (const px of m[1].match(/-?\d+(?:\.\d+)?px/g) || []) { const n = Math.abs(parseFloat(px)); if (n <= 40 && !SCALE.has(n)) off.push(m[0].trim()); }
  L.check('spacing values are on the 4px scale', !off.length, off);
  L.check('keyboard focus on buttons is a 2px ring with a 2px gap', /\.btn:focus-visible \{[^}]*outline: 2px solid var\(--focus\);[^}]*outline-offset: 2px/.test(css));
  L.check('light hover surface is brand light gray #e8e6dc', /--surface-hover: #e8e6dc;/.test(built));
  L.check('no shadow tokens in the built script', !/--shadow(8|16|64)s*:/.test(built));
  L.check('no remote font loading', !/fonts\.googleapis|@import url|@font-face/.test(built));
  // 9.2: type sizes come from the type-scale tokens (--text-sm/--leading-sm, --text-md/--leading-md), not literals.
  const literalType = built.match(/(font-size|line-height): \d+px/g) || [];
  L.check('type sizes use the type-scale tokens', !literalType.length, literalType.length);
  // 9.2: Anthropic motion: short ease-out fades; surfaces do not slide in.
  L.check('surfaces fade in without sliding', !/@keyframes highlighter-enter \{[^}]*translate/.test(built) && !/\[hidden\] \{[^}]*translateY/.test(built));
  await ctx.close(); await L.done(browser);
})();
