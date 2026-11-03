// Malformed stored lists on boot, and storage refusing writes on the note save and the per-site switch paths
// (the annotation save path is in stored-data-safety.test.js).
const L = require('./lib');
const KEY = 'https://example.test/a';
const P = 'Alpha bravo charlie delta echo foxtrot.';
const html = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:16px/1.5 serif;margin:40px"><p id="p">${P}</p></body></html>`;
const good = { xpath: '//*[@id="p"]', startOffset: 6, length: 5, key: 'h', text: 'bravo', prefix: 'Alpha ', suffix: ' charlie delta echo', group: 'gA' };
const errs = p => p.__errors.filter(e => !e.startsWith('DIALOG') && !e.includes('could not use storage'));
const failWrites = (page, on) => page.evaluate(on => {
  if (!window.__origSet) { window.__origSet = window.GM_setValue; window.__origDel = window.GM_deleteValue; }
  window.GM_setValue = on ? () => { throw new Error('quota'); } : window.__origSet;
  window.GM_deleteValue = on ? () => { throw new Error('quota'); } : window.__origDel;
}, on);

(async () => {
  const b = await L.launch();

  // malformed entries inside the stored list
  {
    const junk = [null, 7, 'text', [1], { ...good, xpath: 5, group: 'gB' }, { ...good, startOffset: 'x', group: 'gC' }, { ...good, length: NaN, group: 'gD' }, good];
    const { page } = await L.open(b, { html, store: { [KEY]: JSON.stringify(junk) } });
    await page.waitForTimeout(400);
    const w = await L.wr(page);
    L.check('malformed entries: the good record still renders, the bad ones do not', w.length === 1 && w[0].t === 'bravo', w);
    L.check('malformed entries: no page errors', errs(page).length === 0, errs(page));
    await L.selStr(page, '#p', 'delta'); await L.altKey(page, 'KeyH'); await page.waitForTimeout(250);
    const st = await L.stored(page);
    L.check('malformed entries: a save keeps both usable records and the unusable objects', st.some(r => r.text === 'bravo') && st.some(r => r.text === 'delta') && st.some(r => r.group === 'gB') && st.some(r => r.group === 'gC') && st.some(r => r.group === 'gD'), st);
    await page.close();
  }

  // stored values that are not a list at all
  for (const [name, raw] of [['an object', '{"a":1}'], ['null', 'null'], ['a string', '"x"'], ['cut off mid-write', '[{"xpath":"//*[@id=\\"p\\"]","sta'], ['an empty string', '']]) {
    const { page } = await L.open(b, { html, store: { [KEY]: raw } });
    await page.waitForTimeout(300);
    const none = (await L.wr(page)).length === 0;
    await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'KeyH'); await page.waitForTimeout(250);
    const w = await L.wr(page);
    L.check(`stored value ${name}: boots empty and annotating still works`, none && w.length === 1 && w[0].t === 'bravo' && errs(page).length === 0, [none, w, errs(page)]);
    await page.close();
  }

  // note save while storage refuses writes
  {
    const { page } = await L.open(b, { html, store: {} });
    await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'KeyH'); await page.waitForTimeout(250);
    await failWrites(page, true);
    await L.selStr(page, '#p', 'bravo'); await L.altKey(page, 'KeyN'); await page.waitForTimeout(200);
    await page.evaluate(() => { window.__hl.noteInput.value = 'my note'; window.__hl.noteInput.dispatchEvent(new Event('input')); window.__hl.saveEditor(); });
    await page.waitForTimeout(300);
    const w = await L.wr(page);
    L.check('failing write on note save: the note is on the annotation', w.length === 1 && w[0].n === 'my note', w);
    // Not pinned: the 'Note saved' toast currently replaces the "Couldn't save" warning (reported, not asserted).
    L.check('failing write on note save: no page errors', errs(page).length === 0, errs(page));
    await failWrites(page, false);
    await L.selStr(page, '#p', 'delta'); await L.altKey(page, 'KeyH'); await page.waitForTimeout(250);
    const st = await L.stored(page);
    L.check('after a failed note save the next save stores the note', st.some(r => r.text === 'bravo' && r.note === 'my note'), st);
    await page.close();
  }

  // the per-site switch (Alt+Shift+K) while storage refuses writes
  {
    const { page } = await L.open(b, { html, defaults: true, menu: true, store: { 'rnh:settings': JSON.stringify({ keysOnSites: ['example.test'] }) } });
    await failWrites(page, true);
    await L.altKey(page, 'KeyK', true); await page.waitForTimeout(250);
    L.check('failing write on a site switch: the stored settings are unchanged', JSON.parse(await page.evaluate(() => window.__gm['rnh:settings'])).keysOnSites.includes('example.test'), null);
    L.check('failing write on a site switch: no page errors', errs(page).length === 0, errs(page));
    await page.close();
  }

  await L.done(b);
})();
