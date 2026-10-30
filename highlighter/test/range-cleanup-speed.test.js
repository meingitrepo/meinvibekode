// 8.23: spent Range objects no longer slow the page's own changes down (the browser kept
// updating thousands of them, made by a restore or an edit, until garbage collection), and the
// canonical link is still found wherever it is on the page.
const L = require('./lib');
const W = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima'.split(' ');
const N = 334;
const textOf = i => `${i} ${W.join(' ')}`;
const paras = Array.from({ length: N }, (_, i) => `<p id="p${i}">${textOf(i)}</p>`).join('');
const records = [];
for (let i = 0; i < N; i++) {
  ['bravo', 'golf', 'kilo'].forEach(w => {
    const text = textOf(i), at = text.indexOf(w), g = records.length;
    records.push({ xpath: `//*[@id="p${i}"]`, startOffset: at, length: w.length, key: 'h', text: w,
      prefix: text.slice(Math.max(0, at - 24), at), suffix: text.slice(at + w.length, at + w.length + 24),
      group: `${(1760000000000 + g).toString(36)}r${g}` });
  });
}
// 500 text nodes added and removed: about 0.5 ms on a page without the script.
const probe = page => page.evaluate(() => {
  const host = document.body.appendChild(document.createElement('div'));
  const t0 = performance.now();
  for (let i = 0; i < 500; i++) { const t = document.createTextNode('x'); host.appendChild(t); t.remove(); }
  host.remove();
  return Math.round((performance.now() - t0) * 10) / 10;
});
(async () => {
  const b = await L.launch();
  {
    const html = `<!doctype html><html><body style="font:16px sans-serif;margin:40px">${paras}</body></html>`;
    const { page } = await L.open(b, { html, store: { 'https://example.test/a': JSON.stringify(records) } });
    await page.waitForFunction(n => window.__hl.allWrappers().length === n, records.length, { timeout: 10000 });
    let ms = await probe(page);
    L.check(`after restoring ${records.length}: the page's changes stay fast`, ms < 25, ms);
    for (const p of ['#p3', '#p7']) {
      await L.selStr(page, p, 'echo'); await L.altKey(page, 'KeyH');
      await L.selStr(page, p, 'echo'); await L.altKey(page, 'KeyD');
    }
    await page.evaluate(() => getSelection().removeAllRanges());
    ms = await probe(page);
    L.check('after edits: still fast', ms < 25, ms);
    L.check('all there', (await page.evaluate(() => window.__hl.allWrappers().length)) === records.length, null);
    L.check('no page errors', !page.__errors.length, page.__errors);
    await page.context().close();
  }
  {
    // A canonical link outside <head>, rel in capitals among others: still the page's key.
    const html = `<!doctype html><html><head></head><body><p id="p">Some words to keep.</p>
      <link rel="alternate CANONICAL" href="https://example.test/c"></body></html>`;
    const { page } = await L.open(b, { html });
    L.check('canonical in the body: used', /\/c$/.test(await page.evaluate(() => window.__hl.currentKey)), await page.evaluate(() => window.__hl.currentKey));
    await page.context().close();
  }
  await L.done(b);
})();
