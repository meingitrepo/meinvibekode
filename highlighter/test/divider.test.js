// Pen bar and selection toolbar dividers: identical, 1px line with Fluent's 12px of space each side.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px"><p id="p1">Some plain words to select here.</p></body></html>`;
const results = [];
const check = (name, ok, info) => results.push([name, ok, info]);
const spaces = (p, bar) => p.evaluate(b => {
  const el = window.__hl[b];
  return [...el.querySelectorAll('.divider')].map(d => {
    const r = d.getBoundingClientRect(), prev = d.previousElementSibling.getBoundingClientRect(), next = d.nextElementSibling.getBoundingClientRect();
    return [r.width, Math.round(r.height), Math.round(r.left - prev.right), Math.round(next.left - r.right), getComputedStyle(d).backgroundColor].join(',');
  });
}, bar);
(async () => {
  const browser = await L.launch();
  const { page: p } = await L.open(browser, { html: HTML });
  await L.altKey(p, 'p');
  await p.waitForTimeout(700);
  const pen = await spaces(p, 'penEl');
  check('pen bar has dividers', pen.length >= 3, pen);
  check('pen dividers are identical, 1px wide, 12px each side', new Set(pen).size === 1 && pen[0].startsWith('1,24,12,12,'), pen);
  await L.altKey(p, 'p');
  await L.drag(p, '#p1', 'plain words');
  await p.waitForTimeout(700);
  const tb = await spaces(p, 'toolbarEl');
  check('toolbar dividers match the pen bar', tb.length >= 1 && new Set([...tb, pen[0]]).size === 1, [tb, pen]);
  await L.altKey(p, 'p');
  await p.waitForTimeout(100);
  const gaps = await p.evaluate(() => { const b = [...window.__hl.penEl.querySelectorAll('button')]; return b.slice(1).map((x, i) => Math.round(x.getBoundingClientRect().left - b[i].getBoundingClientRect().right)); });
  check('buttons in a group are 2px apart (spacingHorizontalXXS)', gaps.filter(g => g !== 24 && g < 20).every(g => g === 2), gaps);
  await browser.close();
  let fails = 0;
  results.forEach(([n, ok, i]) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' :: ' + JSON.stringify(i)}`); if (!ok) fails++; });
  console.log(`FAILS ${fails}`);
  process.exit(fails);
})();
