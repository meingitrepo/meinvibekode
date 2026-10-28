// 7.40: the selection toolbar for a clicked annotation.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px;padding-top:120px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet.</p>
<p id="q">Second paragraph kilo lima mike november.</p></body></html>`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  await L.selStr(page, '#p', 'bravo', { endStr: 'echo' });
  await L.altKey(page, 'KeyH');
  await page.evaluate(() => getSelection().removeAllRanges()); await page.mouse.move(900, 650); await page.waitForTimeout(300);
  const pt = await page.evaluate(() => { const r = window.__hl.allWrappers()[0].getClientRects()[0]; return { x: r.left + 5, y: r.top + r.height / 2 }; });
  const box = () => page.evaluate(() => { const e = window.__hl.selectBoxesEl.querySelector('.select-box'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { top: r.top, left: r.left, right: r.right, bottom: r.bottom }; });
  const click = async (x, y) => { await page.mouse.click(x, y); await page.waitForTimeout(350); };
  const btn = label => page.evaluate(l => { const bs = Array.from(window.__hl.toolbarEl.querySelectorAll('button')); const i = bs.findIndex(b => b.dataset.label === l); return i; }, label);
  const press = async label => { const i = await btn(label); if (i < 0) throw new Error('no button ' + label); await page.evaluate(i => window.__hl.toolbarEl.querySelectorAll('button')[i].click(), i); await page.waitForTimeout(350); };
  await click(pt.x, pt.y);
  let t = await L.toolbar(page), bx = await box();
  L.check('toolbar shows on click', !!t && !!bx, { t, bx });
  L.check('toolbar above the box, centered', t && t.rect.bottom <= bx.top && Math.abs((t.rect.left + t.rect.width / 2) - (bx.left + bx.right) / 2) < 2, { t: t && t.rect, bx });
  L.check('own style pressed', t && t.buttons.some(x => x.label === 'Yellow highlight' && x.pressed === 'true'), t && t.buttons);
  L.check('eraser and Add note present', t && t.buttons.some(x => x.label === 'Erase annotation') && t.buttons.some(x => x.label === 'Add note'), null);
  await press('Cyan highlight');
  let w = await L.wr(page);
  L.check('toolbar restyles', w.length && w.every(x => x.k === 'h2'), w);
  t = await L.toolbar(page);
  L.check('toolbar back with green pressed, still selected', t && t.buttons.some(x => x.label === 'Cyan highlight' && x.pressed === 'true') && !!(await box()), t && t.buttons.map(x => x.label));
  await press('Add note');
  L.check('note button opens editor', await page.evaluate(() => !!window.__hl.editor), null);
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await click(pt.x, pt.y);
  await press('Erase annotation');
  L.check('eraser removes, no toast', (await L.wr(page)).length === 0 && (await L.toast(page)) === null, await L.toast(page));
  L.check('toolbar hidden after remove', !(await L.toolbar(page)), null);
  await L.altKey(page, 'KeyZ'); await page.waitForTimeout(200);
  await click(pt.x, pt.y);
  const q = await page.evaluate(() => { const r = document.getElementById('q').getBoundingClientRect(); return { x: r.left + 30, y: r.top + r.height / 2 }; });
  await click(q.x, q.y);
  L.check('click elsewhere hides toolbar and box', !(await L.toolbar(page)) && !(await box()), null);
  await click(pt.x, pt.y);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  L.check('Esc hides toolbar with box', !(await L.toolbar(page)) && !(await box()), null);
  // text selection still gets the normal toolbar
  await L.selStr(page, '#q', 'kilo'); await page.waitForTimeout(400);
  t = await L.toolbar(page);
  L.check('text selection toolbar unchanged', t && t.buttons.some(x => x.label === 'Yellow highlight') && !t.buttons.some(x => x.label === 'Erase annotation'), t && t.buttons.map(x => x.label));
  await page.evaluate(() => getSelection().removeAllRanges()); await page.waitForTimeout(300);
  // Alt+T off: box but no toolbar
  await L.altKey(page, 'KeyT'); await page.waitForTimeout(100);
  await click(pt.x, pt.y);
  L.check('Alt+T off: box only', !(await L.toolbar(page)) && !!(await box()), null);
  await L.altKey(page, 'KeyT'); await page.waitForTimeout(400);
  L.check('Alt+T on again: toolbar for the selected annotation', !!(await L.toolbar(page)), null);
  // scroll keeps it with the box
  await page.evaluate(() => { document.body.style.height = '3000px'; window.scrollBy(0, 40); }); await page.waitForTimeout(200);
  t = await L.toolbar(page); bx = await box();
  L.check('toolbar follows scroll', t && bx && Math.abs(t.rect.bottom + 8 - bx.top) < 2, { t: t && t.rect, bx });
  L.check('no page errors', page.__errors.length === 0, page.__errors);
  await b.close();
  console.log(L.fails ? `${L.fails} FAILED` : 'ALL PASS'); process.exit(L.fails ? 1 : 0);
})();
