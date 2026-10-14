// 8.0: the click-select outline on Trusted Types pages, drawings that added empty scrolling, and
// Enter on the note editor's Delete button.
const L = require('./lib');
(async () => {
  const b = await L.launch();
  {
    // A page that enforces Trusted Types refuses innerHTML: the outline must not use it.
    const html = '<!doctype html><html><body><p id="p">alpha bravo charlie delta echo foxtrot</p></body></html>';
    const { page } = await L.open(b, { html, headers: { 'content-security-policy': "require-trusted-types-for 'script'" } });
    await L.selStr(page, '#p', 'bravo charlie'); await L.altKey(page, 'h');
    await page.evaluate(() => getSelection().removeAllRanges());
    const at = await page.evaluate(() => { const r = document.querySelector('[data-highlighter-wrapper]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(at.x, at.y); await page.waitForTimeout(300);
    const box = await page.evaluate(() => { const el = window.__hl.selectBoxesEl.firstElementChild; const p = el && el.querySelector('path'); return el && { hidden: el.hidden, d: p && p.getAttribute('d') }; });
    L.check('Trusted Types page: the outline shows', box && !box.hidden && !!box.d, box);
    L.check('Trusted Types page: no errors', page.__errors.length === 0, page.__errors);
  }
  {
    // An underline sharing text with a highlight, at the bottom of a small scrolling box and at
    // the right edge of the page: no scrolling appears.
    const html = `<!doctype html><html><body style="margin:0">
<p id="p" style="margin:0;text-align:right;font:16px sans-serif">some words here and the very last words</p>
<div id="box" style="overflow:auto;height:60px;width:300px;border:1px solid #888;margin-top:20px"><p style="margin:0">first line</p><p style="margin:0">second line</p><p id="s" style="margin:0">third and last</p></div>
</body></html>`;
    const { page } = await L.open(b, { html });
    const dims = () => page.evaluate(() => { const e = document.scrollingElement, box = document.getElementById('box'); return { w: e.scrollWidth - e.clientWidth, h: box.scrollHeight - box.clientHeight }; });
    const before = await dims();
    await L.selStr(page, '#p', 'last words'); await L.altKey(page, 'h');
    await L.selStr(page, '#p', 'words', { nth: 1 }); await L.altKey(page, 'u');
    await L.selStr(page, '#s', 'last'); await L.altKey(page, 'h');
    await L.selStr(page, '#s', 'last'); await L.altKey(page, 'u');
    await page.evaluate(() => getSelection().removeAllRanges()); await page.waitForTimeout(300);
    const after = await dims();
    L.check('setup: highlights with underlines inside', (await L.wr(page)).map(w => w.k).join() === 'h,u,h,u', await L.wr(page));
    L.check('no sideways scrolling added to the page', after.w === before.w, { before, after });
    L.check('no scrolling added to the box', after.h === before.h, { before, after });
    const shown = await page.evaluate(() => Array.from(document.querySelectorAll('svg[data-highlighter-svg] path')).every(p => p.getBoundingClientRect().width > 10));
    L.check('the strokes still draw', shown, null);
  }
  {
    // Tab to the editor's Delete button and press Enter: the note goes.
    const html = '<!doctype html><html><body><p id="p">alpha bravo charlie delta echo foxtrot</p></body></html>';
    const { page } = await L.open(b, { html });
    await L.selStr(page, '#p', 'bravo charlie'); await L.altKey(page, 'n');
    await page.keyboard.type('a note'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    L.check('Enter in the text box saves', (await L.wr(page))[0].n === 'a note', await L.wr(page));
    await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'n'); await page.waitForTimeout(200);
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => window.__hl.uiRoot.activeElement && window.__hl.uiRoot.activeElement.dataset.label);
    L.check('setup: Delete note has focus', focused === 'Delete note', focused);
    await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    const w = await L.wr(page);
    L.check('Enter on Delete deletes the note, the highlight stays', w.length === 1 && !w[0].n, w);
    L.check('with Undo offered', (await L.toast(page)) === 'Deleted note · Undo', await L.toast(page));
  }
  {
    // Delete in the note editor deletes text after the caret first, then the note.
    const html = '<!doctype html><html><body><p id="p">alpha bravo charlie delta echo foxtrot</p></body></html>';
    const { page } = await L.open(b, { html });
    await L.selStr(page, '#p', 'bravo charlie'); await L.altKey(page, 'n');
    await page.keyboard.type('a note'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'n'); await page.waitForTimeout(200);
    await page.keyboard.press('Home'); await page.keyboard.press('Delete');
    const text = await page.evaluate(() => window.__hl.noteInput.value);
    L.check('Delete before text deletes a character', text === ' note', text);
    await page.keyboard.press('End'); await page.keyboard.press('Delete'); await page.waitForTimeout(300);
    const w = await L.wr(page);
    L.check('Delete at the end deletes the note, the highlight stays', w.length === 1 && !w[0].n, w);
    L.check('Delete: Undo offered', (await L.toast(page)) === 'Deleted note · Undo', await L.toast(page));
  }
  await L.done(b);
})();
