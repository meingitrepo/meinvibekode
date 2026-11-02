// One selected annotation vanishing must not leave two frame loops following the boxes, and
// restyling from the keyboard keeps focus on the toolbar.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px;padding-top:120px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet.</p>
<p id="q">Second paragraph kilo lima mike november oscar papa.</p></body></html>`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  await L.selStr(page, '#p', 'bravo', { endStr: 'echo' }); await L.altKey(page, 'KeyH');
  await L.selStr(page, '#q', 'kilo', { endStr: 'mike' }); await L.altKey(page, 'KeyH');
  await page.evaluate(() => getSelection().removeAllRanges()); await page.mouse.move(900, 650); await page.waitForTimeout(300);
  const pt = sel => page.evaluate(s => { const w = window.__hl.allWrappers().find(w => w.closest(s)); const r = w.getClientRects()[0]; return { x: r.left + 5, y: r.top + r.height / 2 }; }, sel);
  const p = await pt('#p'), q = await pt('#q');
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(200);
  await page.keyboard.down('Control'); await page.mouse.click(q.x, q.y); await page.keyboard.up('Control'); await page.waitForTimeout(300);
  L.check('two selected', (await page.evaluate(() => window.__hl.selectedGroups.length)) === 2, null);
  // Counts the follow callbacks waiting for a frame.
  await page.evaluate(() => {
    const raf = window.requestAnimationFrame.bind(window), caf = window.cancelAnimationFrame.bind(window);
    window.__live = new Set();
    window.requestAnimationFrame = fn => { const id = raf(t => { window.__live.delete(id); fn(t); }); if (fn.name === 'followSelectBoxes') window.__live.add(id); return id; };
    window.cancelAnimationFrame = id => { window.__live.delete(id); caf(id); };
  });
  await page.waitForTimeout(100);
  // The second annotation's text goes away without the selection hearing of it.
  await page.evaluate(() => { window.__hl.allWrappers().filter(w => w.closest('#q')).forEach(w => w.remove()); });
  await page.waitForTimeout(400);
  const live = await page.evaluate(() => window.__live.size);
  L.check('one follow loop after a selected annotation vanished', live === 1, live);
  // Keyboard restyle from the toolbar of a clicked annotation keeps focus in the toolbar.
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(400);
  const idx = await page.evaluate(() => {
    const bs = Array.from(window.__hl.toolbarEl.querySelectorAll('button'));
    const i = bs.findIndex(x => x.dataset.label === 'Underline');
    bs[i].focus(); return i;
  });
  L.check('underline button found', idx >= 0, idx);
  await page.keyboard.press('Enter'); await page.waitForTimeout(400);
  const foc = await page.evaluate(() => {
    const t = window.__hl.toolbarEl, a = t.getRootNode().activeElement;
    return { inside: !!a && t.contains(a), i: Array.from(t.querySelectorAll('button')).indexOf(a) };
  });
  L.check('focus stays on the same toolbar button after a restyle', foc.inside && foc.i === idx, foc);
  L.check('no page errors', page.__errors.length === 0, page.__errors);
  await b.close();
  console.log(L.fails ? `${L.fails} FAILED` : 'ALL PASS'); process.exit(L.fails ? 1 : 0);
})();
