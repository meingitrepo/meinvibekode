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
  const bg = () => page.evaluate(() => getComputedStyle(window.__hl.panelList.querySelector('.item')).backgroundColor);
  const row = () => page.evaluate(() => { const r = window.__hl.panelList.querySelector('.item').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(5, 5);
  const rest = await bg();
  const p = await row();
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(150);
  const hover = await bg();
  await page.mouse.down();
  await page.waitForTimeout(150);
  const pressed = await bg();
  await page.mouse.up();
  L.check('row rest is transparent', rest === 'rgba(0, 0, 0, 0)', rest);
  L.check('row hover is SubtleBackgroundHover', hover === 'rgb(240, 238, 230)', hover);
  L.check('row pressed is SubtleBackgroundPressed', pressed === 'rgb(227, 218, 204)', pressed);
  // Ticked row: SubtleBackgroundSelected.
  await page.evaluate(() => { const c = window.__hl.panelList.querySelector('.item .check'); c.checked = true; });
  await page.mouse.move(5, 5);
  await page.waitForTimeout(150);
  const selected = await bg();
  L.check('ticked row is SubtleBackgroundSelected', selected === 'rgb(245, 227, 199)', selected);
  await page.evaluate(() => { window.__hl.panelList.querySelector('.item .check').checked = false; });
  // Forced colors.
  await page.emulateMedia({ forcedColors: 'active' });
  await page.waitForTimeout(100);
  const fc = await page.evaluate(() => {
    const list = window.__hl.panelList, out = {};
    const sys = c => { const e = document.createElement('i'); e.style.color = c; document.body.appendChild(e); const v = getComputedStyle(e).color; e.remove(); return v; };
    const un = list.querySelector('.item .check'), on = document.createElement('input');
    on.type = 'checkbox'; on.className = 'check'; on.checked = true; list.appendChild(on);
    const dis = document.createElement('input'); dis.type = 'checkbox'; dis.className = 'check'; dis.disabled = true; list.appendChild(dis);
    const cs = (e, p) => getComputedStyle(e, p);
    out.highlight = sys('Highlight'); out.buttonText = sys('ButtonText'); out.gray = sys('GrayText'); out.highlightText = sys('HighlightText');
    out.unBorder = cs(un).borderTopColor;
    out.onBg = cs(on).backgroundColor; out.onBorder = cs(on).borderTopColor; out.onMark = cs(on, '::after').backgroundColor;
    out.disBorder = cs(dis).borderTopColor;
    const bar = list.querySelector('.item-main'); out.barFA = cs(bar, '::before').forcedColorAdjust;
    out.swatch = cs(bar, '::before').backgroundColor;
    on.remove(); dis.remove();
    return out;
  });
  L.check('forced: checkbox border ButtonText', fc.unBorder === fc.buttonText, fc);
  L.check('forced: checked box Highlight with HighlightText mark', fc.onBg === fc.highlight && fc.onBorder === fc.highlight && fc.onMark === fc.highlightText, fc);
  L.check('forced: disabled box GrayText', fc.disBorder === fc.gray, fc);
  L.check('forced: color bar keeps its swatch', fc.barFA === 'none', fc);
  // Row hover and selected: Highlight with HighlightText.
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(150);
  const fh = await page.evaluate(() => { const r = window.__hl.panelList.querySelector('.item'); const s = getComputedStyle(r); return { bg: s.backgroundColor, color: getComputedStyle(r.querySelector('.item-text')).color }; });
  L.check('forced: hovered row is Highlight/HighlightText', fh.bg === fc.highlight && fh.color === fc.highlightText, fh);
  // Select box outline.
  const sb = await page.evaluate(() => {
    const host = window.__hl.panelList, b = document.createElement('div'); b.className = 'select-box';
    b.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10"/></svg>'; host.appendChild(b);
    const e = document.createElement('i'); e.style.color = 'Highlight'; document.body.appendChild(e);
    const r = { stroke: getComputedStyle(b.querySelector('path')).stroke, want: getComputedStyle(e).color }; b.remove(); e.remove(); return r;
  });
  L.check('forced: select box outline is Highlight', sb.stroke === sb.want, sb);
  await ctx.close(); await L.done(browser);
})();
