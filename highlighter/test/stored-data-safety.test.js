// A record that throws while rendering, or a failing storage write, never stops a page's
// annotations from restoring or loses saved ones (docs/specs/data-safety.md).
const L = require('./lib');
const CTX = 24;
const KEY = 'https://example.test/a';
const P1 = 'Paragraph alpha one is here with some words.';
const P2 = 'Paragraph beta two is here with other words.';
const html = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:16px/1.5 serif;margin:40px"><p id="p1">${P1}</p><p id="p2">${P2}</p></body></html>`;
function rec(xpath, block, text, { key = 'h', group, extra = {} } = {}) {
  const at = block.indexOf(text);
  return { xpath, startOffset: at, length: text.length, key, text, prefix: block.slice(Math.max(0, at - CTX), at), suffix: block.slice(at + text.length, at + text.length + CTX), group, ...extra };
}
const good = () => rec('//*[@id="p1"]', P1, 'alpha one', { group: 'gA' });
const other = () => rec('//*[@id="p2"]', P2, 'beta two', { key: 'u', group: 'gB' });
const WARNED = 'could not restore an annotation';
const errors = p => p.__errors.filter(e => !e.startsWith('DIALOG') && !e.includes(WARNED) && !e.includes('could not use storage'));
const warnings = p => p.__errors.filter(e => e.includes(WARNED));
// Makes walking the text of #p2 throw, so locating a record there fails.
const boomOn = p => p.evaluate(() => {
  if (!window.__origTW) window.__origTW = document.createTreeWalker;
  document.createTreeWalker = function (root, ...rest) {
    if (window.__boom && root && root.id === 'p2') throw new Error('boom');
    return window.__origTW.call(this, root, ...rest);
  };
  window.__boom = true;
});
const boomOff = p => p.evaluate(() => { window.__boom = false; });
const deliver = (p, list) => p.evaluate(([k, v]) => { try { window.__deliver(k, undefined, v, true); return null; } catch (e) { return String(e); } }, [KEY, JSON.stringify(list)]);

(async () => {
  const b = await L.launch();

  // 1. a remote change brings a record whose render throws: nothing is lost, nothing escapes
  {
    const { page } = await L.open(b, { html, store: { [KEY]: JSON.stringify([good()]) } });
    await page.waitForTimeout(400);
    await boomOn(page);
    const thrown = await deliver(page, [good(), other()]);
    await page.waitForTimeout(400);
    L.check('render throw: nothing escapes the live-sync handler', thrown === null, thrown);
    const w = await L.wr(page);
    L.check('render throw: the existing annotation stays', w.length === 1 && w[0].t === 'alpha one', w);
    const pending = await page.evaluate(() => window.__hl.pending.map(r => r.group));
    L.check('render throw: the failing record waits in pending', pending.includes('gB'), pending);
    await boomOff(page);
    await L.selStr(page, '#p1', 'words'); await L.altKey(page, 'KeyH'); await page.waitForTimeout(300);
    const st = await L.stored(page);
    L.check('render throw: a later save keeps the failing record', st.some(r => r.group === 'gB') && st.some(r => r.group === 'gA'), st);
    L.check('render throw: no page errors', errors(page).length === 0, errors(page));
    L.check('render throw: logged once, not per retry', warnings(page).length === 1, warnings(page).length);
    await page.close();
  }

  // 3. records this version cannot use are not rendered, but a save writes them back as they were
  {
    const noText = { xpath: '//*[@id="p2"]', startOffset: 0, length: 4, key: 'h', group: 'gX', rev: 5 };
    const noXpath = { anchor: 'future', startOffset: 10, length: 8, key: 'u', text: 'beta two', group: 'gF', extra: { nested: [1, 2] } };
    const badGroupOnly = { ...other(), text: undefined, group: 'gA' };   // shares a group with a usable record
    const legacy = (() => { const r = rec('//*[@id="p2"]', P2, 'other words', { key: 'h4' }); delete r.group; return r; })();
    const list = [good(), noText, noXpath, badGroupOnly, legacy];
    const { page } = await L.open(b, { html, store: { [KEY]: JSON.stringify(list) } });
    await page.waitForTimeout(600);
    const w = await L.wr(page);
    L.check('unusable records: only the usable ones are rendered', w.length === 2 && w.some(x => x.t === 'alpha one') && w.some(x => x.t === 'other words'), w);
    await L.selStr(page, '#p1', 'words'); await L.altKey(page, 'KeyH'); await page.waitForTimeout(300);
    const st = await L.stored(page);
    const kept = o => st.some(r => JSON.stringify(r) === JSON.stringify(o));
    L.check('unusable records: written back unchanged by a save', kept(noText) && kept(noXpath) && kept(badGroupOnly), st);
    L.check('unusable records: the usable ones are saved too', st.some(r => r.text === 'alpha one') && st.some(r => r.text === 'words'), st);
    await deliver(page, [...st, { ...noText, group: 'gY' }]);   // another tab's list holds one too
    await page.waitForTimeout(300);
    const after = await L.wr(page);
    L.check('unusable records: not rendered when another tab sends them either', !after.some(x => x.g === 'gY' || x.t === 'Para'), after);
    L.check('unusable records: no page errors', errors(page).length === 0, errors(page));
    await page.close();
  }

  // 2. storage refuses writes: the page keeps working, the user is told once, nothing is lost
  {
    const { page } = await L.open(b, { html, store: {} });
    const failWrites = on => page.evaluate(on => {
      if (!window.__origSet) { window.__origSet = window.GM_setValue; window.__origDel = window.GM_deleteValue; }
      window.GM_setValue = on ? () => { throw new Error('quota'); } : window.__origSet;
      window.GM_deleteValue = on ? () => { throw new Error('quota'); } : window.__origDel;
    }, on);
    const toastNow = () => L.toast(page);
    const hideToast = () => page.evaluate(() => { window.__hl.toastEl.hidden = true; });
    const mark = async (sel, str, code) => { await L.selStr(page, sel, str); await L.altKey(page, code); await page.waitForTimeout(250); };

    await failWrites(true);
    await mark('#p1', 'alpha one', 'KeyH');
    let w = await L.wr(page);
    L.check('failing write: the annotation is still made', w.length === 1 && w[0].t === 'alpha one', w);
    L.check('failing write: the user is told', /save/i.test(await toastNow() || ''), await toastNow());
    await hideToast();
    await mark('#p1', 'words', 'KeyH');
    L.check('failing write: told once, not on every save', (await toastNow()) === null, await toastNow());
    await failWrites(false);
    await mark('#p2', 'beta two', 'KeyU');
    const st = await L.stored(page);
    L.check('after a failure the next save writes everything', st.length === 3 && st.some(r => r.text === 'alpha one'), st);
    L.check('failing write: no tombstone for what was never saved', (await L.stored(page, KEY, true)).every(r => !('gone' in r)), await L.stored(page, KEY, true));
    await failWrites(true);
    await mark('#p2', 'other', 'KeyH');
    L.check('a failure after a success tells again', /save/i.test(await toastNow() || ''), await toastNow());
    L.check('failing write: no page errors', errors(page).length === 0, errors(page));
    await page.close();
  }

  await b.close();
  console.log(L.fails ? `${L.fails} FAILED` : 'all passed');
  process.exit(L.fails ? 1 : 0);
})();
