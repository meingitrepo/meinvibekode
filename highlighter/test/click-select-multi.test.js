// 7.42: Ctrl+click / Shift+click select several annotations.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px;padding-top:120px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike.</p>
<p id="q">Second paragraph november oscar papa quebec romeo.</p></body></html>`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  for (const w of ['bravo', 'echo', 'hotel', 'kilo']) { await L.selStr(page, '#p', w); await L.altKey(page, 'KeyH'); }
  await L.selStr(page, '#q', 'oscar'); await L.altKey(page, 'KeyU');
  await page.evaluate(() => getSelection().removeAllRanges()); await page.mouse.move(900, 650); await page.waitForTimeout(300);
  const pos = t => page.evaluate(t => { const w = window.__hl.allWrappers().find(w => w.textContent === t); const r = w.getBoundingClientRect(); return { x: r.left + 3, y: r.top + r.height / 2 }; }, t);
  const sel = () => page.evaluate(() => window.__hl.selectedGroups.map(g => document.querySelector(`[data-highlighter-group="${g}"]`).textContent).sort());
  const boxes = () => page.evaluate(() => Array.from(window.__hl.selectBoxesEl.querySelectorAll('.select-box')).filter(e => !e.hidden).length);
  const click = async (t, mod) => { const p = await pos(t); if (mod) await page.keyboard.down(mod); await page.mouse.click(p.x, p.y); if (mod) await page.keyboard.up(mod); await page.waitForTimeout(350); };
  await click('bravo');
  await click('hotel', 'Control');
  L.check('ctrl+click adds', JSON.stringify(await sel()) === '["bravo","hotel"]' && (await boxes()) === 2, await sel());
  await click('bravo', 'Control');
  L.check('ctrl+click removes', JSON.stringify(await sel()) === '["hotel"]', await sel());
  await click('oscar', 'Shift');
  L.check('shift+click selects the span', JSON.stringify(await sel()) === '["hotel","kilo","oscar"]', await sel());
  L.check('no text selection from shift+click', await page.evaluate(() => getSelection().isCollapsed), await page.evaluate(() => getSelection().toString()));
  await click('echo', 'Shift');
  L.check('shift+click again from the anchor (hotel), just that span', JSON.stringify(await sel()) === '["echo","hotel"]', await sel());
  let t = await L.toolbar(page);
  L.check('toolbar for several', t && t.buttons.some(x => x.label === 'Remove 2 annotations'), t && t.buttons.map(x => x.label));
  await page.keyboard.press('Digit1'); await page.waitForTimeout(200);
  let w = await L.wr(page);
  L.check('2 restyles all selected', ['echo', 'hotel'].every(s => w.find(x => x.t === s).k === 'h2') && w.find(x => x.t === 'kilo').k === 'h', w);
  await L.altKey(page, 'KeyZ');
  w = await L.wr(page);
  L.check('one undo restores all styles', ['echo', 'hotel', 'kilo'].every(s => w.find(x => x.t === s).k === 'h'), w);
  // reselect and delete via toolbar
  await click('echo'); await click('kilo', 'Control');
  t = await L.toolbar(page);
  const i = await page.evaluate(() => Array.from(window.__hl.toolbarEl.querySelectorAll('button')).findIndex(b => b.dataset.label === 'Remove 2 annotations'));
  L.check('toolbar remove label', i >= 0, t && t.buttons.map(x => x.label));
  await page.evaluate(i => window.__hl.toolbarEl.querySelectorAll('button')[i].click(), i); await page.waitForTimeout(300);
  w = await L.wr(page);
  L.check('toolbar removes both', !w.some(x => x.t === 'echo' || x.t === 'kilo') && w.length === 3, w);
  L.check('toast says 2', /Removed 2 annotations · Undo/.test(await L.toast(page) || ''), await L.toast(page));
  await L.altKey(page, 'KeyZ');
  L.check('one undo brings both back', (await L.wr(page)).length === 5, await L.wr(page));
  // Delete key on mixed styles
  await click('hotel'); await click('oscar', 'Control');
  await page.keyboard.press('Delete'); await page.waitForTimeout(200);
  L.check('Delete removes all selected', (await L.wr(page)).length === 3 && (await boxes()) === 0, await L.wr(page));
  await L.altKey(page, 'KeyZ');
  // Alt+Backspace too
  await click('bravo'); await click('echo', 'Control');
  await L.altKey(page, 'Backspace');
  L.check('Alt+Backspace removes all selected', (await L.wr(page)).length === 3, await L.wr(page));
  await L.altKey(page, 'KeyZ');
  // N edits the first
  await click('kilo'); await click('bravo', 'Control');
  await page.keyboard.press('KeyN'); await page.waitForTimeout(200);
  const eg = await page.evaluate(() => { const e = window.__hl.editor; return e && document.querySelector(`[data-highlighter-group="${e.group}"]`).textContent; });
  L.check('N opens the first in reading order', eg === 'bravo', eg);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  // own style pressed when all same: select bravo+kilo (both yellow), press 1 -> removes both
  await click('bravo'); await click('kilo', 'Control');
  t = await L.toolbar(page);
  L.check('common style pressed', t && t.buttons.some(x => x.label === 'Remove yellow highlight' && x.pressed === 'true'), t && t.buttons);
  await page.keyboard.press('Digit3'); await page.waitForTimeout(200);
  L.check('own style removes both', (await L.wr(page)).length === 3, await L.wr(page));
  await L.altKey(page, 'KeyZ');
  // Esc clears, plain click selects one
  await click('bravo'); await click('kilo', 'Control'); await click('echo');
  L.check('plain click selects just one', JSON.stringify(await sel()) === '["echo"]', await sel());
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  L.check('Esc clears', (await sel()).length === 0 && (await boxes()) === 0, null);
  const c = await page.evaluate(async () => { return null; });
  await click('bravo');
  const col = await page.evaluate(() => getComputedStyle(window.__hl.selectBoxesEl.querySelector('.select-box')).color);
  L.check('box is black on a light page', col === 'rgb(0, 0, 0)', col);
  L.check('no page errors', page.__errors.length === 0, page.__errors);
  await b.close();
  console.log(L.fails ? `${L.fails} FAILED` : 'ALL PASS'); process.exit(L.fails ? 1 : 0);
})();
