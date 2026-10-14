// 8.16: D erases (Backspace no longer does); on one annotation with a note, D deletes the note first.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px;padding-top:120px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike.</p></body></html>`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  for (const w of ['bravo', 'echo', 'hotel']) {
    await L.selStr(page, '#p', w); await L.altKey(page, 'n');
    await page.keyboard.type(`note ${w}`); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  }
  await page.evaluate(() => getSelection().removeAllRanges()); await page.mouse.move(900, 650); await page.waitForTimeout(300);
  const pos = t => page.evaluate(t => { const w = window.__hl.allWrappers().find(w => w.textContent === t); const r = w.getBoundingClientRect(); return { x: r.left + 3, y: r.top + r.height / 2 }; }, t);
  const get = async t => (await L.wr(page)).find(w => w.t === t);
  // Pointing at one with a note: Alt+D deletes the note, Alt+D again erases it.
  let p = await pos('bravo'); await page.mouse.move(p.x, p.y); await page.waitForTimeout(200);
  await L.altKey(page, 'Backspace');
  L.check('Alt+Backspace no longer erases', (await get('bravo')) && (await get('bravo')).n === 'note bravo', await get('bravo'));
  await L.altKey(page, 'd');
  L.check('first Alt+D deletes the note, keeps the annotation', (await get('bravo')) && !(await get('bravo')).n, await get('bravo'));
  L.check('with its toast', (await L.toast(page)) === 'Deleted note · Undo', await L.toast(page));
  L.check('the note card\'s Delete names Alt+D', await page.evaluate(() => window.__hl.cardDelete.getAttribute('aria-label')) === 'Delete note (Alt+D)', null);
  await L.altKey(page, 'd');
  L.check('second Alt+D erases it', !(await get('bravo')), await L.wr(page));
  // Alt+Delete erases at once, note and all.
  p = await pos('echo'); await page.mouse.move(p.x, p.y); await page.waitForTimeout(200);
  await L.altKey(page, 'Delete');
  L.check('Alt+Delete erases it at once', !(await get('echo')), await L.wr(page));
  await L.altKey(page, 'KeyZ'); await L.altKey(page, 'KeyZ');
  L.check('undo brings echo back, bravo without its note', (await get('echo')).n === 'note echo' && (await get('bravo')) && !(await get('bravo')).n, await L.wr(page));
  // Clicked: one with a note loses the note first; several erase at once.
  await page.mouse.move(900, 650);
  const click = async (t, mod) => { const q = await pos(t); if (mod) await page.keyboard.down(mod); await page.mouse.click(q.x, q.y); if (mod) await page.keyboard.up(mod); await page.waitForTimeout(350); };
  const eraserTip = () => page.evaluate(() => { const b = Array.from(window.__hl.toolbarEl.querySelectorAll('button')).find(b => /^Erase (annotation|\d)/.test(b.dataset.label)); return b && b.getAttribute('aria-label'); });
  await click('hotel');
  L.check('eraser tip on one with a note names Alt+Delete', (await eraserTip()) === 'Erase annotation (Alt+Delete)', await eraserTip());
  await page.keyboard.press('d'); await page.waitForTimeout(200);
  L.check('D on one selected deletes its note', (await get('hotel')) && !(await get('hotel')).n, await get('hotel'));
  L.check('then the eraser tip names Alt+D', (await eraserTip()) === 'Erase annotation (Alt+D)', await eraserTip());
  await page.keyboard.press('Escape');
  await click('echo'); await click('hotel', 'Control');
  await page.keyboard.press('d'); await page.waitForTimeout(200);
  L.check('D on several erases them all', !(await get('echo')) && !(await get('hotel')), await L.wr(page));
  // Alt+Shift+D clears the page.
  await page.mouse.move(900, 650);
  await L.altKey(page, 'd', true);
  L.check('Alt+Shift+D clears the page', (await L.wr(page)).length === 0, await L.wr(page));
  L.check('with its toast', /^Cleared \dx annotations? · Undo$/.test(await L.toast(page) || ''), await L.toast(page));
  await L.done(b);
})();
