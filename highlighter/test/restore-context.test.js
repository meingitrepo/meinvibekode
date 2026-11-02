// Restore must not trust a short text at its saved offset (or the first copy of it on the page)
// when what surrounds it has changed or it could be any of several places.
const L = require('./lib');
const CTX = 24;
function rec(xpath, old, text, nth = 0) {
  let at = -1; for (let i = 0; i <= nth; i++) at = old.indexOf(text, at + 1);
  return { xpath, startOffset: at, length: text.length, key: 'h', text, prefix: old.slice(Math.max(0, at - CTX), at), suffix: old.slice(at + text.length, at + text.length + CTX), group: 'g' + Math.random().toString(36).slice(2, 8) };
}
const KEY = 'https://example.test/a';
const page = b => `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:16px/1.5 serif">${b}</body></html>`;
const before = () => window.__hl.allWrappers().map(w => { const r = document.createRange(); r.setStart(w.parentNode, 0); r.setEndBefore(w); return r.toString(); });
(async () => {
  const browser = await L.launch();
  // 1. Edited paragraph: a different "the" now sits at the saved offset; the old one moved on.
  {
    const OLD = 'One cat saw the dog run home today.';
    const NOW = 'Twelve char the other mat. One cat saw the dog run home today.';
    const r = rec('//*[@id="p"]', OLD, 'the');
    const { ctx, page: p } = await L.open(browser, { html: page(`<p id="p">${NOW}</p>`), store: { [KEY]: JSON.stringify([r]) } });
    await L.wr(p);
    const at = await p.evaluate(before);
    L.check('short word at saved offset with other context: follows its context', at.length === 1 && at[0] === 'Twelve char the other mat. One cat saw ', at);
    await ctx.close();
  }
  // 2. Same, but the surroundings are unchanged: the saved offset still wins (also a long text).
  {
    const T = 'Yes the cat. Yes the cat.';
    const r = rec('//*[@id="p"]', T, 'the', 1);
    const LONG = 'A fairly long annotated sentence that sits here for sure. Then other words.';
    const r2 = rec('//*[@id="q"]', LONG, 'A fairly long annotated sentence that sits here for sure.');
    const { ctx, page: p } = await L.open(browser, { html: page(`<p id="p">${T}</p><p id="q">${LONG.replace('Then other words.', 'Totally new tail.')}</p>`), store: { [KEY]: JSON.stringify([r, r2]) } });
    await L.wr(p);
    const at = await p.evaluate(before);
    L.check('unchanged context and long text still placed at offset', at.includes('Yes the cat. Yes ') && at.includes(''), at);
    L.check('both placed', at.length === 2, at);
    await ctx.close();
  }
  // 3. Dead XPath, a short whole-block text that exists in several blocks: not guessed.
  {
    const r = rec('//*[@id="gone"]', 'Paris', 'Paris');
    const { ctx, page: p } = await L.open(browser, { html: page(`<p>Paris</p><table><tr><td>Paris</td></tr></table>`), store: { [KEY]: JSON.stringify([r]) } });
    const w = await L.wr(p);
    L.check('dead XPath, repeated short block: not placed on the first copy', w.length === 0, w);
    await ctx.close();
  }
  // 4. Dead XPath, short whole-block text that is on the page once: still placed.
  {
    const r = rec('//*[@id="gone"]', 'Paris', 'Paris');
    const { ctx, page: p } = await L.open(browser, { html: page('<p>Hello there.</p><table><tr><td>Paris</td></tr></table>'), store: { [KEY]: JSON.stringify([r]) } });
    const w = await L.wr(p);
    L.check('dead XPath, single short block: placed', w.length === 1, w);
    await ctx.close();
  }
  // 5. A 1-2 character text at its saved offset, a neighbour word changed: kept.
  {
    const OLD = 'Status OK since 10:42 today, all fine here.';
    const NOW = 'Status OK since 11:07 today, all fine here.';
    const r = rec('//*[@id="p"]', OLD, 'OK');
    const { ctx, page: p } = await L.open(browser, { html: page(`<p id="p">${NOW}</p>`), store: { [KEY]: JSON.stringify([r]) } });
    const w = await L.wr(p);
    L.check('short text, changed neighbour: still placed', w.length === 1, w);
    await ctx.close();
  }
  // 6. A record saved without any context, dead XPath, text on the page once: still placed.
  {
    const r = rec('//*[@id="gone"]', 'Paris', 'Paris'); delete r.prefix; delete r.suffix;
    const { ctx, page: p } = await L.open(browser, { html: page('<p>Hello Paris today.</p>'), store: { [KEY]: JSON.stringify([r]) } });
    const w = await L.wr(p);
    L.check('no saved context, dead XPath: placed as before', w.length === 1, w);
    await ctx.close();
  }
  console.log('FAILS', L.fails);
  await browser.close();
})();
