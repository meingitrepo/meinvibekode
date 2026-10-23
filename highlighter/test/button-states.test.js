// Fluent v9 button states: pressed (hover or key-held), Regular to Filled icon swap, selected, disabled.
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
    return { bg: cs.backgroundColor, fg: cs.color, f: getComputedStyle(b.querySelector('.ic-f')).display, r: getComputedStyle(b.querySelector('.ic-r')).display };
  });
  const rest = await info();
  check('at rest the Regular icon shows, not the Filled one', rest.r !== 'none' && rest.f === 'none', rest);
  const box = await p.evaluate(() => { const r = [...window.__hl.penEl.querySelectorAll('button')].find(x => x.dataset.label === 'Eraser').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await p.mouse.move(box.x, box.y); await p.waitForTimeout(250);
  const hov = await info();
  check('hover swaps to the Filled icon', hov.f !== 'none' && hov.r === 'none', hov);
  await p.mouse.down(); await p.waitForTimeout(250);
  const prs = await info();
  check('pressed changes the background from hover', prs.bg !== hov.bg, { hov, prs });
  await p.mouse.up(); await p.mouse.move(5, 5);
  // key-held press with the pointer away: Fluent's :active:focus-visible
  await p.evaluate(() => [...window.__hl.penEl.querySelectorAll('button')].find(x => x.dataset.label === 'Eraser').focus());
  await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(250);
  const foc = await info();
  await p.keyboard.down('Space'); await p.waitForTimeout(250);
  const held = await info();
  check('a key-held press shows the pressed background', held.bg !== foc.bg, { foc, held });
  await p.keyboard.up('Space');
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([states].map(f => f(browser).catch(e => check(`${f.name} threw`, false, String(e)))));
  await browser.close();
  let fails = 0;
  results.forEach(([name, ok, info]) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + JSON.stringify(info)}`); if (!ok) fails++; });
  console.log(`FAILS ${fails}`);
  process.exit(fails);
})();
