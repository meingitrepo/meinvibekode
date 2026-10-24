// Pen bar and selection toolbar dividers: identical, 1px line with Fluent's 12px of space each side.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px"><p id="p1">Some plain words to select here.</p></body></html>`;
const results = [];
const check = (name, ok, info) => results.push([name, ok, info]);
const spaces = (p, bar) => p.evaluate(b => {
  const el = window.__hl[b];
  return [...el.querySelectorAll('.divider')].map(d => {
    const r = d.getBoundingClientRect(), prev = d.previousElementSibling.getBoundingClientRect(), next = (d.nextElementSibling.classList.contains('pen-text') ? d.nextElementSibling.nextElementSibling : d.nextElementSibling).getBoundingClientRect();
    return [r.width, r.height, Math.round(r.left - prev.right), Math.round(next.left - r.right), getComputedStyle(d).backgroundColor].join(',');
  });
}, bar);
(async () => {
  const browser = await L.launch();
  const { page: p } = await L.open(browser, { html: HTML });
  await L.altKey(p, 'p');
  const pen = await spaces(p, 'penEl');
  check('pen bar has dividers', pen.length >= 3, pen);
  check('pen dividers are identical, 1px wide, 12px each side', new Set(pen).size === 1 && pen[0].startsWith('1,24,12,12,'), pen);
  await L.altKey(p, 'p');
  await L.drag(p, '#p1', 'plain words');
  const tb = await spaces(p, 'toolbarEl');
  check('toolbar dividers match the pen bar', tb.length >= 1 && new Set([...tb, pen[0]]).size === 1, tb);
  await browser.close();
  results.forEach(([n, ok, i]) => console.log(ok ? 'ok  ' : 'FAIL', n, ok ? '' : JSON.stringify(i)));
  process.exit(results.every(r => r[1]) ? 0 : 1);
})();
