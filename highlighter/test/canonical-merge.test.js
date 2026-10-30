// Annotations saved under a page's plain URL (before the site's canonical link was known, or by an SPA
// navigation with a stale one) move to the canonical key on a later visit; the old keys go.
const L = require('./lib');
const CANON = 'https://example.test/guide-canonical';
const PLAIN = 'https://example.test/guide';
const VISIT = `${PLAIN}?utm_source=mail`;   // urlKey(VISIT) is PLAIN; VISIT itself is a key too
const T = 'First paragraph with some alpha words and bravo words and charlie words inside.';
const HTML = `<!doctype html><html><head><meta charset="utf-8"><link rel="canonical" href="${CANON}"></head><body style="font:18px/1.6 serif;margin:40px"><p id="p1">${T}</p></body></html>`;
const rec = (text, group) => {
  const at = T.indexOf(text);
  return { xpath: '//*[@id="p1"]', startOffset: at, length: text.length, key: 'h', text, prefix: T.slice(Math.max(0, at - 10), at), suffix: T.slice(at + text.length, at + text.length + 10), group };
};
(async () => {
  const browser = await L.launch();
  const alpha = rec('alpha words', 'gAlpha');
  const store = {
    [CANON]: JSON.stringify([alpha]),
    [PLAIN]: JSON.stringify([alpha, rec('bravo words', 'gBravo')]),   // alpha is saved under both keys
    [VISIT]: JSON.stringify([rec('charlie words', 'gCharlie')])
  };
  const { ctx, page } = await L.open(browser, { html: HTML, url: VISIT, store });
  L.check('the page is kept under its canonical key', (await page.evaluate(() => window.__hl.currentKey)) === CANON, await page.evaluate(() => window.__hl.currentKey));
  const shown = (await L.wr(page)).map(w => w.t).sort();
  L.check('records from the canonical and both plain keys are on the page', shown.join('|') === 'alpha words|bravo words|charlie words', shown);
  const stored = (await L.stored(page, CANON)).map(r => r.text).sort();
  L.check('they are all saved under the canonical key, the repeated one once', stored.join('|') === 'alpha words|bravo words|charlie words', stored);
  const keys = (await page.evaluate(() => Object.keys(window.__gm))).filter(k => k === PLAIN || k === VISIT);
  L.check('the plain-URL keys are gone', keys.length === 0, keys);
  L.check('no page errors', page.__errors.length === 0, page.__errors);
  await ctx.close();

  // The same selection under both keys, and only the plain-key copy has a note: the note survives the merge.
  {
    const store2 = {
      [CANON]: JSON.stringify([alpha]),
      [PLAIN]: JSON.stringify([{ ...alpha, note: 'keep me' }])
    };
    const { ctx: ctx2, page: page2 } = await L.open(browser, { html: HTML, url: VISIT, store: store2 });
    const notes = (await L.stored(page2, CANON)).map(r => r.text + '=' + (r.note || ''));
    L.check('a note only on the plain-key copy is kept, in the store', notes.join('|') === 'alpha words=keep me', notes);
    const shown2 = (await L.wr(page2)).map(w => w.t + '=' + (w.n || ''));
    L.check('and on the page', shown2.join('|') === 'alpha words=keep me', shown2);
    await ctx2.close();
  }
  await L.done(browser);
})();
