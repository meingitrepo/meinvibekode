// Delete at the end of a new note's text does not throw the note away; a refused storage write
// never reads as a success when an unwritten note is dropped or saved annotations are forgotten.
const L = require('./lib');
const KEY = 'https://example.test/a';
const OTHER = 'https://example.test/b';
const html = `<html><body style="font:16px sans-serif;margin:40px;padding-top:120px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike.</p></body></html>`;
const failWrites = (page, on) => page.evaluate(on => {
  if (!window.__origSet) { window.__origSet = window.GM_setValue; window.__origDel = window.GM_deleteValue; }
  window.GM_setValue = on ? () => { throw new Error('quota'); } : window.__origSet;
  window.GM_deleteValue = on ? () => { throw new Error('quota'); } : window.__origDel;
}, on);
const rec = (group, text) => ({ xpath: '//*[@id="p"]', startOffset: 0, length: text.length, key: 'h', text, prefix: '', suffix: '', group });
(async () => {
  const b = await L.launch();
  // Delete at the end of a new note's text
  {
    const { page } = await L.open(b, { html });
    await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'n');
    await page.keyboard.type('draft text'); await page.keyboard.press('Delete'); await page.waitForTimeout(300);
    const open = await page.evaluate(() => !window.__hl.editorEl.hidden);
    L.check('Delete at the end of a new note keeps the editor open', open, open);
    L.check('Delete at the end of a new note keeps its text', (await page.evaluate(() => window.__hl.noteInput.value)) === 'draft text');
    L.check('Delete at the end of a new note keeps the annotation', (await L.wr(page)).length === 1, await L.wr(page));
    await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    L.check('the note still saves', (await L.wr(page))[0].n === 'draft text', await L.wr(page));
    await page.close();
  }
  // An empty new note: Delete still drops it
  {
    const { page } = await L.open(b, { html });
    await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'n');
    await page.keyboard.press('Delete'); await page.waitForTimeout(300);
    L.check('Delete on an empty new note drops it', (await L.wr(page)).length === 0, await L.wr(page));
    await page.close();
  }
  // A refused write while an unwritten note is dropped leaves the stored data as it was
  {
    const { page } = await L.open(b, { html });
    await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'n'); await page.waitForTimeout(300);
    const before = await L.stored(page);
    await failWrites(page, true);
    await page.evaluate(() => { history.pushState({}, '', '/c'); }); await page.waitForTimeout(1500);
    const after = await L.stored(page, KEY, true);
    L.check('dropping a note with a refused write leaves the stored data', JSON.stringify(after.filter(r => !r.gone)) === JSON.stringify(before) && after.every(r => !('gone' in r)), after);
    await page.close();
  }
  // Control: with storage working, dropping the note does write
  {
    const { page } = await L.open(b, { html });
    await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'n'); await page.waitForTimeout(300);
    await page.evaluate(() => { history.pushState({}, '', '/c'); }); await page.waitForTimeout(1500);
    L.check('control: dropping a note with working storage removes it', (await L.stored(page)).length === 0, await L.stored(page));
    await page.close();
  }
  // Forgetting saved annotations of another page with a refused write
  {
    const store = { [KEY]: JSON.stringify([rec('gA', 'Alpha')]), [OTHER]: JSON.stringify([rec('gB', 'Alpha')]) };
    const { page } = await L.open(b, { html, store });
    await page.waitForTimeout(400);
    await page.evaluate(() => 0);
    await failWrites(page, true);
    await page.evaluate(() => window.__hl.helpEl && 0); await L.altKey(page, 'KeyO', true); await page.waitForTimeout(400);
    await page.evaluate(() => { const r = window.__hl; r.everythingSelectAll.click(); r.everythingSelectAll.click(); r.everythingSelectAll.click(); });
    await page.evaluate(() => { const r = window.__hl; r.everythingSelectAll.click(); r.everythingSelectAll.click(); r.everythingForget.click(); });
    await page.waitForTimeout(200);
    const st = await page.evaluate(k => JSON.parse(window.__gm[k]), OTHER);
    L.check('forgetting with a refused write leaves the other page as it was', st.length === 1 && st[0].group === 'gB', st);
    L.check('the failure is announced', /save/i.test(await L.toast(page) || ''), await L.toast(page));
    await page.close();
  }
  await L.done(b);
})();
