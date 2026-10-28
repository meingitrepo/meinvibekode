// The review after 8.21: a selected annotation that sits still costs nothing (its outline isn't
// worked out again, and the page isn't hit-tested for bars over it); the page's keys wait while
// everything saved (Alt+Shift+O) is open; Delete on a new note can be undone; reduced motion
// draws nothing in; deleting everything saved closes the search.
const L = require('./lib');
const text = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima';
const paras = Array.from({ length: 30 }, (_, i) => `<p id="p${i}">${i} ${text}</p>`).join('');
// Counts hit tests, and changes to the selection outlines, over `ms`.
const quiet = (page, ms) => page.evaluate(ms => new Promise(done => {
  let hits = 0;
  const efp = document.elementFromPoint;
  document.elementFromPoint = function (...a) { hits++; return efp.apply(this, a); };
  let changes = 0;
  const mo = new MutationObserver(list => { changes += list.length; });
  mo.observe(window.__hl.selectBoxesEl, { subtree: true, childList: true, attributes: true });
  setTimeout(() => { document.elementFromPoint = efp; mo.disconnect(); done({ hits, changes }); }, ms);
}), ms);
const clickWrapper = async (page, i = 0) => {
  const pt = await page.evaluate(i => { const r = window.__hl.allWrappers()[i].getClientRects()[0]; return { x: r.left + 4, y: r.top + r.height / 2 }; }, i);
  await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(200);
};
(async () => {
  const b = await L.launch();
  {
    // A sticky bar on the page: no longer looked for.
    const html = `<!doctype html><html><body style="font:16px sans-serif;margin:40px">
      <div style="position:sticky;top:0;height:30px;background:#ddd">bar</div>${paras}</body></html>`;
    const { page } = await L.open(b, { html });
    for (const w of ['bravo', 'hotel']) { await L.selStr(page, '#p8', w); await L.altKey(page, 'KeyH'); }
    await page.evaluate(() => getSelection().removeAllRanges());
    await clickWrapper(page, 0);
    await page.keyboard.down('Shift'); await clickWrapper(page, 1); await page.keyboard.up('Shift');
    await page.waitForTimeout(300);
    const q = await quiet(page, 1200);
    L.check('still selection: no hit tests, outlines untouched', q.hits === 0 && q.changes === 0, q);
    L.check('both outlined', await page.evaluate(() => window.__hl.selectedGroups.length) === 2, await page.evaluate(() => window.__hl.selectedGroups));
    L.check('no page errors', !page.__errors.length, page.__errors);
    await page.context().close();
  }
  {
    const html = `<!doctype html><html><body style="font:16px sans-serif;margin:40px">${paras}</body></html>`;
    const { page } = await L.open(b, { html });
    await L.selStr(page, '#p1', 'bravo'); await L.altKey(page, 'KeyH');
    await page.evaluate(() => getSelection().removeAllRanges());
    await L.altKey(page, 'KeyJ'); await page.waitForTimeout(400);   // pointed at by the jump
    await L.altKey(page, 'KeyO', true);
    L.check('setup: everything saved is open', await page.evaluate(() => !window.__hl.everythingEl.hidden), null);
    for (const k of ['KeyD', 'Digit1', 'KeyU', 'KeyZ']) await L.altKey(page, k);
    let w = await L.wr(page);
    L.check('keys behind everything saved change nothing', w.length === 1 && w[0].k === 'h', w);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);

    // Delete on a new note takes the highlight made for it.
    await L.selStr(page, '#p2', 'echo foxtrot'); await L.altKey(page, 'KeyN');
    await page.keyboard.type('my words'); await page.keyboard.press('Delete'); await page.waitForTimeout(300);
    w = await L.wr(page);
    L.check('Delete on a new note: its highlight goes', w.length === 1, w);
    // An empty new note's Delete just drops it, as before.
    await L.selStr(page, '#p3', 'golf'); await L.altKey(page, 'KeyN');
    await page.keyboard.press('Delete'); await page.waitForTimeout(300);
    L.check('Delete on an empty new note: dropped, no message', (await L.wr(page)).length === 1 && !(await L.toast(page)), [await L.wr(page), await L.toast(page)]);

    // Reduced motion: a new annotation is there at once.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await L.selStr(page, '#p4', 'kilo'); await L.altKey(page, 'KeyU');
    const anim = await page.evaluate(() => Array.from(window.__hl.getSvg(window.__hl.allWrappers().find(w => w.textContent === 'kilo')).querySelectorAll('path'), p => p.style.animation));
    L.check('reduced motion: no draw-in', anim.length && anim.every(a => !a), anim);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await L.selStr(page, '#p5', 'kilo'); await L.altKey(page, 'KeyU');
    const anim2 = await page.evaluate(() => Array.from(window.__hl.getSvg(window.__hl.allWrappers().filter(w => w.textContent === 'kilo')[1]).querySelectorAll('path'), p => p.style.animation));
    L.check('otherwise it draws in', anim2.length && anim2.every(a => /highlighter-dash/.test(a)), anim2);

    // Deleting everything saved (menu) closes the search over the page.
    await L.altKey(page, 'KeyO', true);
    await page.evaluate(() => window.__menu['Delete all saved annotations…']()); await page.waitForTimeout(200);
    const after = await page.evaluate(() => ({ open: !window.__hl.everythingEl.hidden, keys: Object.keys(window.__gm) }));
    L.check('delete all: nothing saved, search closed', !after.open && !after.keys.some(k => k.startsWith('https://')) && (await L.wr(page)).length === 0, after);
    L.check('delete all: says so', page.__errors.includes('DIALOG Deleted all saved annotations.'), page.__errors);
    L.check('no other page errors', !page.__errors.filter(e => !e.startsWith('DIALOG')).length, page.__errors);
  }
  await L.done(b);
})();
