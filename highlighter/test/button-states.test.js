// Button states: pressed (hover or key-held), Regular icon kept on hover, selected, disabled.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px"><p id="p1">Some plain words to mark.</p></body></html>`;
const results = [];
const check = (name, ok, info) => results.push([name, ok, info]);

async function states(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  await L.altKey(p, 'p');
  const info = () => p.evaluate(() => {
    const b = [...window.__hl.penEl.querySelectorAll('button')].find(x => x.dataset.label === 'Eraser');
    const cs = getComputedStyle(b);
    return { bg: cs.backgroundColor, fg: cs.color, f: b.querySelectorAll('.ic-f').length, r: getComputedStyle(b.querySelector('.ic-r')).display };
  });
  const rest = await info();
  check('at rest the Regular icon shows and no Filled path exists', rest.r !== 'none' && rest.f === 0, rest);
  const box = await p.evaluate(() => { const r = [...window.__hl.penEl.querySelectorAll('button')].find(x => x.dataset.label === 'Eraser').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(box.x, box.y); await p.waitForTimeout(250);
  const hov = await info();
  check('hover keeps the Regular icon (no Filled swap)', hov.f === 0 && hov.r !== 'none', hov);
  await p.mouse.down(); await p.waitForTimeout(250);
  const prs = await info();
  check('pressed changes the background from hover', prs.bg !== hov.bg, { hov, prs });
  await p.mouse.up(); await p.mouse.move(5, 5);
  // key-held press with the pointer away: :active:focus-visible
  await p.evaluate(() => [...window.__hl.penEl.querySelectorAll('button')].find(x => x.dataset.label === 'Eraser').focus());
  await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(250);
  const foc = await info();
  await p.keyboard.down('Space'); await p.waitForTimeout(250);
  const held = await info();
  check('a key-held press shows the pressed background', held.bg !== foc.bg, { foc, held });
  await p.keyboard.up('Space');
  await ctx.close();
}

// Hovered or pressed, every toolbar icon keeps a visible outline (Regular) that contrasts with the hover background.
async function hoverVisible(browser) {
  for (const scheme of ['light', 'dark']) {
    const html = HTML.replace('<body style="', `<body style="${scheme === 'dark' ? 'background:#121212;color:#e8e8e8;' : ''}`);
    const { ctx, page: p } = await L.open(browser, { html, scheme });
    await L.selStr(p, '#p1', 'plain words'); await p.waitForTimeout(400);
    const n = await p.evaluate(() => window.__hl.toolbarEl.querySelectorAll('button').length);
    for (let i = 0; i < n; i++) {
      for (const press of [false, true]) {
        const box = await p.evaluate(i => { const r = [...window.__hl.toolbarEl.querySelectorAll('button')][i].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, i);
        await p.mouse.move(box.x, box.y); if (press) await p.mouse.down(); await p.waitForTimeout(250);
        const r = await p.evaluate(i => {
          const b = [...window.__hl.toolbarEl.querySelectorAll('button')][i];
          const shown = [...b.querySelectorAll('.ic-r, .ic-f')].filter(x => getComputedStyle(x).display !== 'none');
          const lum = c => { const v = c.match(/[\d.]+/g).slice(0, 3).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
          const a = lum(getComputedStyle(b.querySelector('.icon')).color), g = lum(getComputedStyle(b).backgroundColor);
          return { label: b.dataset.label, shown: shown.length, contrast: (Math.max(a, g) + 0.05) / (Math.min(a, g) + 0.05) };
        }, i);
        if (press) { await p.mouse.move(5, 5); await p.mouse.up(); }
        check(`${scheme} ${r.label} ${press ? 'pressed' : 'hovered'}: outline shows and contrasts`, r.shown > 0 && r.contrast >= 3, r);
      }
    }
    await ctx.close();
  }
}

// Each highlighter button carries its own colour, at rest and when selected (toolbar and pen bar).
async function swatches(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  const fills = (bar) => p.evaluate(bar => [...window.__hl[bar].querySelectorAll('button')].map(b => [...b.querySelectorAll('svg > path[fill]')].map(x => x.getAttribute('fill'))[0]).filter(Boolean), bar);
  await L.selStr(p, '#p1', 'plain words'); await p.waitForTimeout(400);
  const tb = await fills('toolbarEl');
  check('toolbar: every highlighter button shows its own distinct colour', tb.length >= 3 && new Set(tb).size === tb.length, tb);
  await p.mouse.click(5, 5);
  await L.altKey(p, 'p'); await p.waitForTimeout(300);
  const pen = await fills('penEl');
  check('pen bar: every highlighter button shows its own distinct colour', pen.length >= 3 && new Set(pen).size === pen.length, pen);
  await p.evaluate(() => [...window.__hl.penEl.querySelectorAll('button')].find(b => b.querySelector('svg > path[fill]')).click()); await p.waitForTimeout(300);
  const sel = await fills('penEl');
  check('pen bar: colours stay when a highlighter is selected', sel.length === pen.length && sel.every((c, i) => c === pen[i]), { pen, sel });
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([states, hoverVisible, swatches].map(f => f(browser).catch(e => check(`${f.name} threw`, false, String(e)))));
  await browser.close();
  let fails = 0;
  results.forEach(([name, ok, info]) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + JSON.stringify(info)}`); if (!ok) fails++; });
  console.log(`FAILS ${fails}`);
  process.exit(fails);
})();
