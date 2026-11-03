// A step that throws after createWrapper took the text out of the page never leaves the page
// text missing or half-unwrapped (docs/specs/wrap-extract.md).
const L = require('./lib');
const P1 = 'Paragraph alpha one is here with some words.';
const html = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:16px/1.5 serif;margin:40px"><p id="p1">${P1}</p></body></html>`;

(async () => {
  const b = await L.launch();
  const text = p => p.evaluate(() => document.getElementById('p1').textContent);
  const spans = p => p.evaluate(() => document.querySelectorAll('#p1 span[data-rnh-wrapper], #p1 [data-rnh]').length);
  const cases = [
    ['insertNode throws after the extract', 'Range.prototype', 'insertNode'],
    ['a later step (getComputedStyle) throws', 'window', 'getComputedStyle']
  ];
  for (const [name, owner, fn] of cases) {
    const { page } = await L.open(b, { html, store: {} });
    await page.waitForTimeout(300);
    await page.evaluate(([owner, fn]) => {
      const o = owner === 'window' ? window : Range.prototype;
      const orig = o[fn];
      o[fn] = function (...a) {
        if (window.__boom && (fn !== 'insertNode' || a[0] && a[0].nodeType === 1 && a[0].tagName === 'SPAN')) throw new Error('boom');
        return orig.apply(this, a);
      };
      window.__boom = true;
    }, [owner, fn]);
    await L.selStr(page, '#p1', 'alpha one');
    await L.altKey(page, 'KeyH');
    await page.waitForTimeout(300);
    await page.evaluate(() => { window.__boom = false; });
    L.check(`${name}: the page text is intact`, (await text(page)) === P1, await text(page));
    L.check(`${name}: no wrapper is left`, (await L.wr(page)).length === 0, await L.wr(page));
    await page.close();
  }
  await L.done(b);
})();
