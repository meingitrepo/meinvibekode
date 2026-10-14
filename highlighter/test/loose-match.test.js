// 7.30: looser matching on restore (case, spacing, a changed word; ambiguous and unrelated places refused).
const L = require('./lib');
const CTX = 24;
// A record for `text` as it stood in `old` (the paragraph's text when it was saved), at its nth occurrence.
function rec(xpath, old, text, { key = 'h', nth = 0, group = 'g' + Math.random().toString(36).slice(2, 8), extra = {} } = {}) {
  let at = -1; for (let i = 0; i <= nth; i++) at = old.indexOf(text, at + 1);
  if (at < 0) throw new Error('not in old text: ' + text);
  return { xpath, startOffset: at, length: text.length, key, text, prefix: old.slice(Math.max(0, at - CTX), at), suffix: old.slice(at + text.length, at + text.length + CTX), group, ...extra };
}
const KEY = 'https://example.test/a';
const page = paras => `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:16px/1.5 serif">${paras}</body></html>`;
(async () => {
  const browser = await L.launch();
  // 1. Capitals changed around a short, repeated word (the case verified on 7.26).
  {
    const OLD = 'On a clear day the sky is blue and the sea is calm, the end.';
    const NOW = 'Updated: on a clear day THE SKY IS BLUE and the sea is calm, the end and the rest.';
    const r = rec('//*[@id="p1"]', OLD, 'and', { nth: 0 });
    const r2 = rec('//*[@id="p1"]', OLD, 'the', { nth: 1 });   // "the sea"
    const html = page(`<p id="p1">${NOW}</p><p>Another the and the and the.</p>`);
    const { ctx, page: p } = await L.open(browser, { html, store: { [KEY]: JSON.stringify([r, r2]) } });
    const w = await L.wr(p);
    L.check('capitals: "and" found again', w.some(x => x.t === 'and' && x.g === r.group), w);
    const placed = await p.evaluate(() => { const w = window.__hl.allWrappers().find(x => x.textContent === 'the'); if (!w) return null; const pre = document.createRange(); pre.setStart(w.parentNode, 0); pre.setEndBefore(w); return pre.toString(); });
    L.check('capitals: "the" placed before "sea", not elsewhere', placed === 'Updated: on a clear day THE SKY IS BLUE and ', placed);
    const st = await L.stored(p, KEY);
    L.check('relocated records saved with their new context', st.some(x => x.text === 'the' && x.prefix.endsWith('BLUE and ')), st);
    await ctx.close();
  }
  // 2. Spacing and a changed word next to it; offset moved.
  {
    const OLD = 'Posted 5m ago by alice: Great point about the release notes, thanks.';
    const NOW = 'Edited · Posted   6m ago by alice:\n   Great point about the  release notes, thanks! Great point indeed, says bob.';
    const r = rec('//*[@id="c"]', OLD, 'Great point');
    const html = page(`<div id="c">${NOW}</div><div>Great point here too, by bob.</div>`);
    const { ctx, page: p } = await L.open(browser, { html, store: { [KEY]: JSON.stringify([r]) } });
    const w = await L.wr(p);
    const where = await p.evaluate(() => { const w = window.__hl.allWrappers()[0]; return w ? w.parentElement.id : null; });
    L.check('spacing + changed word: placed in its own block', w.length === 1 && where === 'c', { w, where });
    await ctx.close();
  }
  // 3. Ambiguous: two places with equally good surroundings -> not placed.
  {
    const OLD = 'Reply to this comment and share it now.';
    const r = rec('//*[@id="x"]', OLD, 'share');
    const html = page(`<p id="other">reply to this comment AND share it now.</p><p>REPLY TO THIS COMMENT and share it now.</p>`);
    const { ctx, page: p } = await L.open(browser, { html, store: { [KEY]: JSON.stringify([r]) } });
    const w = await L.wr(p);
    L.check('ambiguous: not placed', w.length === 0, w);
    await ctx.close();
  }
  // 4. Unrelated surroundings -> not placed.
  {
    const OLD = 'The committee approved the budget for next year after a long debate.';
    const r = rec('//*[@id="gone"]', OLD, 'the budget');
    const html = page(`<p id="p">Nobody wanted to talk about the budget at dinner, so we did not.</p><p>And the budget again in a list.</p>`);
    const { ctx, page: p } = await L.open(browser, { html, store: { [KEY]: JSON.stringify([r]) } });
    const w = await L.wr(p);
    L.check('unrelated context: not placed', w.length === 0, w);
    await ctx.close();
  }
  // 5. Dead XPath: found in another block anywhere on the page by its surroundings.
  {
    const OLD = 'Step two: open the settings page and choose Privacy, then Save.';
    const r = rec('//*[@id="old-id"]', OLD, 'Privacy');
    const html = page(`<p>Privacy policy link in the header.</p><ol><li id="new-id">Step 2: Open the Settings page and choose Privacy, then save.</li></ol><p>More about Privacy later.</p>`);
    const { ctx, page: p } = await L.open(browser, { html, store: { [KEY]: JSON.stringify([r]) } });
    const where = await p.evaluate(() => window.__hl.allWrappers().map(w => w.parentElement.id));
    L.check('dead XPath: found by its surroundings anywhere', JSON.stringify(where) === '["new-id"]', where);
    await ctx.close();
  }
  // 6. Exact matches unchanged: text at its offset is used as before, even when also elsewhere.
  {
    const T = 'Alpha beta gamma. Alpha beta gamma.';
    const r = rec('//*[@id="p"]', T, 'beta', { nth: 1 });
    const { ctx, page: p } = await L.open(browser, { html: page(`<p id="p">${T}</p>`), store: { [KEY]: JSON.stringify([r]) } });
    const at = await p.evaluate(() => { const w = window.__hl.allWrappers()[0]; const pre = document.createRange(); pre.setStart(w.parentNode, 0); pre.setEndBefore(w); return pre.toString().length; });
    L.check('exact offset still wins', at === r.startOffset, { at, want: r.startOffset });
    await ctx.close();
  }
  // 7. A very common text: more than LOOSE_MATCH_MAX_PLACES places -> given up.
  {
    const OLD = 'xx the first one yy';
    const r = rec('//*[@id="gone"]', OLD, 'the');
    const many = Array.from({ length: 250 }, (_, i) => `<span>the ${i}</span>`).join(' ');
    const { ctx, page: p } = await L.open(browser, { html: page(`<p>XX THE FIRST ONE YY</p><p>${many}</p>`), store: { [KEY]: JSON.stringify([r]) } });
    const w = await L.wr(p);
    L.check('too common: not placed', w.length === 0, w.length);
    await ctx.close();
  }
  console.log('FAILS', L.fails);
  await browser.close();
})();
