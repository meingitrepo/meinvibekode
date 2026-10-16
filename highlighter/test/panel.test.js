const L = require('./lib');
const filler = n => Array.from({ length: n }, (_, i) => `<p>Filler paragraph number ${i} with some ordinary words in it.</p>`).join('');
const HTML = `<!doctype html><html><head><title>Test (page) [one]</title></head><body style="font: 16px/1.5 sans-serif; margin: 40px; max-width: 700px">
<p id="p1">Alpha beta gamma delta epsilon zeta eta theta iota kappa.</p>
<p id="p2">One two three four five six seven eight nine ten eleven twelve thirteen fourteen.</p>
${filler(40)}
<p id="p3">The quick brown fox jumps over the lazy dog near the river bank.</p>
${filler(40)}
<p id="p4">Repeated words here. Repeated words there. And a *star* and _under_ line.</p>
<p id="p5">Missing text never shows up.</p>
</body></html>`;
(async () => {
  const browser = await L.launch();
  const today = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  // --- legacy record without group + a record that can't be found ---
  const store = { 'https://example.test/a': JSON.stringify([
    { xpath: '//*[@id="p1"]', startOffset: 6, length: 4, key: 'h', text: 'beta', prefix: 'Alpha ', suffix: ' gamma delta epsilon zeta' },
    { xpath: '//*[@id="p9"]', startOffset: 0, length: 12, key: 'h3', text: 'Gone forever', prefix: '', suffix: '', group: 'mg0abcde12345', note: 'lost note #tag' }
  ]) };
  const { ctx, page } = await L.open(browser, { html: HTML, store });
  let st = await L.stored(page);
  L.check('legacy record gets added date', st.some(r => r.text === 'beta' && r.added > 1e12 && /^old-/.test(r.group)), st);
  // annotate with note
  await L.selStr(page, '#p2', 'three four'); await L.altKey(page, '1');
  await L.selStr(page, '#p3', 'quick brown fox'); await L.altKey(page, 'n'); await page.keyboard.type('Fox note #animals'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  await L.selStr(page, '#p4', 'Repeated words'); await L.altKey(page, 'u');
  await L.selStr(page, '#p4', '*star* and _under_'); await L.altKey(page, 's');
  // note card date
  await page.evaluate(() => { const w = window.__hl.allWrappers().find(w => w.textContent === 'quick brown fox'); w.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(200);
  await page.mouse.move(...await L.badge(page, 'quick brown fox')); await page.waitForTimeout(450);   // 8.32: on the badge, after 300 ms
  const hint = await page.evaluate(() => !window.__hl.noteCardEl.hidden && window.__hl.cardHint.textContent);
  L.check('note card shows date', hint === `Added ${today}`, hint);
  await page.mouse.move(5, 5); await page.waitForTimeout(400);
  // panel
  await L.altKey(page, 'o');
  let it = await L.items(page);
  L.check('panel opens with 5 on-page + missing section', !(await page.evaluate(() => window.__hl.panelEl.hidden)) && it.filter(i => i.g && !i.missing).length === 5 && it.some(i => i.label && /Not found/.test(i.label)) && it.some(i => i.missing && i.text === 'Gone forever'), it);
  L.check('order and meta', it[0].text === 'beta' && /Yellow highlight · added /.test(it[0].meta) && it[1].text === 'three four' && it[2].note === 'Fox note #animals', it.slice(0, 3));
  L.check('missing has date from group id', it.find(i => i.missing).meta.includes('added'), it.find(i => i.missing));
  const count = await page.evaluate(() => window.__hl.panelCount.textContent);
  L.check('count', count === '5', count);
  const focusOk = await page.evaluate(() => window.__hl.uiRoot.activeElement === window.__hl.panelFilter);
  L.check('filter focused', focusOk);
  await page.keyboard.type('#animals');
  await page.waitForTimeout(100);
  it = await L.items(page);
  L.check('filter by tag', it.length === 1 && it[0].text === 'quick brown fox', it);
  await page.keyboard.press('Escape'); await page.waitForTimeout(50);
  it = await L.items(page);
  L.check('esc clears filter', it.filter(i => i.g).length === 6, it.length);
  await page.keyboard.type('#tag'); await page.waitForTimeout(80);
  it = await L.items(page);
  L.check('filter matches missing', it.some(i => i.missing) && it.filter(i => i.g).length === 1, it);
  await page.keyboard.press('Escape');
  // click item -> scroll + flash
  await page.evaluate(() => window.scrollTo(0, 0));
  // The flash is noted when it starts, since a slow machine may end it before the scroll stops.
  await page.evaluate(() => { window.__flashed = false; new MutationObserver(() => { window.__flashed = true; }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-highlighter-flash'] }); });
  await page.evaluate(() => { const el = Array.from(window.__hl.panelList.querySelectorAll('[data-group]')).find(e => e.querySelector('.item-text').textContent === 'quick brown fox'); el.querySelector('.item-main').click(); });
  await page.waitForTimeout(100); await L.scrolled(page);
  const fl = await page.evaluate(() => { const w = window.__hl.allWrappers().find(w => w.textContent === 'quick brown fox'); const r = w.getBoundingClientRect(); return { top: r.top, flash: window.__flashed, y: scrollY }; });
  L.check('click scrolls and flashes', fl.top > 100 && fl.top < 600 && fl.flash && fl.y > 300, fl);
  // copy markdown
  await page.evaluate(() => window.__hl.panelCopy.click()); await page.waitForTimeout(100);
  const md = await page.evaluate(() => window.__clip);
  console.log(md);
  L.check('markdown header', md.startsWith('## [Test (page) \\[one\\]](https://example.test/a)'), md.split('\n')[0]);
  L.check('markdown quote+link', md.includes('> quick brown fox [↗](https://example.test/a#:~:text=quick%20brown%20fox)\n\nFox note #animals'), md);
  L.check('markdown escapes', md.includes('> \\*star\\* and \\_under\\_'), md);
  L.check('markdown context for repeated', /text=Here%2E?|text=[^)]*Repeated%20words[^)]*/.test(md) && md.includes('-,Repeated%20words') === false, md);
  const tst = await L.toast(page);
  L.check('copy toast', tst === 'Copied 5x annotations', tst);
  // edit note from panel
  await page.evaluate(() => { const el = Array.from(window.__hl.panelList.querySelectorAll('[data-group]')).find(e => e.querySelector('.item-text').textContent === 'three four'); el.querySelector('[data-act="note"]').click(); });
  await page.waitForTimeout(200);
  const ed = await page.evaluate(() => !!window.__hl.editor && !window.__hl.editorEl.hidden);
  L.check('edit opens editor', ed);
  await page.keyboard.type('Numbers'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  it = await L.items(page);
  L.check('panel updates note', it.find(i => i.text === 'three four').note === 'Numbers', it);
  // delete from panel
  await page.evaluate(() => { const el = Array.from(window.__hl.panelList.querySelectorAll('[data-group]')).find(e => e.querySelector('.item-text').textContent === 'three four'); el.querySelector('[data-act="delete"]').click(); });
  await L.until(page, () => !Array.from(window.__hl.panelList.querySelectorAll('.item-text')).some(e => e.textContent === 'three four'));
  it = await L.items(page);
  L.check('delete', !it.some(i => i.text === 'three four') && (await L.toast(page)) === 'Erased 1x annotation · Undo', [it.length, await L.toast(page)]);
  st = await L.stored(page);
  L.check('delete stored', !st.some(r => r.text === 'three four'), st.length);
  await page.evaluate(() => window.__hl.toastAction.click());
  await L.until(page, () => Array.from(window.__hl.panelList.querySelectorAll('.item-text')).some(e => e.textContent === 'three four'));
  it = await L.items(page);
  L.check('undo brings it back to panel', it.some(i => i.text === 'three four'), it.length);
  // attach missing to selection
  await L.selStr(page, '#p5', 'never shows');
  await page.evaluate(() => { const el = window.__hl.panelList.querySelector('.missing'); el.querySelector('[data-act="attach"]').click(); });
  await page.waitForTimeout(250);
  const att = await page.evaluate(() => window.__hl.allWrappers().filter(w => w.textContent === 'never shows').map(w => [w.getAttribute('data-style-key'), w.getAttribute('data-highlighter-group'), w.getAttribute('data-highlighter-note')]));
  L.check('attach places annotation with group+note', att.length === 1 && att[0][0] === 'h3' && att[0][1] === 'mg0abcde12345' && att[0][2] === 'lost note #tag', att);
  st = await L.stored(page);
  L.check('attach stored, pending gone', st.filter(r => r.group === 'mg0abcde12345').length === 1 && st.find(r => r.group === 'mg0abcde12345').text === 'never shows', st.filter(r => r.group === 'mg0abcde12345'));
  it = await L.items(page);
  L.check('no missing section after attach', !it.some(i => i.missing || i.label), it);
  // undo attach (Alt+Z typed in the filter box is left to the box)
  await L.altKey(page, 'z');
  L.check('Alt+Z ignored in filter', (await L.stored(page)).some(r => r.text === 'never shows'));
  await page.evaluate(() => window.__hl.uiRoot.activeElement && window.__hl.uiRoot.activeElement.blur());
  await L.altKey(page, 'z');
  st = await L.stored(page);
  it = await L.items(page);
  L.check('undo attach -> missing again', st.some(r => r.text === 'Gone forever') && it.some(i => i.missing), [st.length, it.length]);
  // attach without selection
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.evaluate(() => window.__hl.panelList.querySelector('.missing [data-act="attach"]').click());
  await page.waitForTimeout(100);
  L.check('attach w/o selection toast', /Select the text/.test(await L.toast(page)), await L.toast(page));
  // forget
  await page.evaluate(() => window.__hl.panelList.querySelector('.missing [data-act="forget"]').click());
  await page.waitForTimeout(150);
  st = await L.stored(page);
  L.check('forget', !st.some(r => r.text === 'Gone forever') && /^Forgot 1x annotation · Undo$/.test(await L.toast(page)), st.length);
  // close with Alt+O
  await L.altKey(page, 'o');
  L.check('Alt+O closes', await page.evaluate(() => window.__hl.panelEl.hidden));
  // Alt+O in the filter box closes it on a non-Latin layout too (key is the layout's letter)
  L.check('Alt+O from filter, Arabic layout', await page.evaluate(() => {
    const r = window.__hl; r.openPanel(); r.panelFilter.focus();
    r.panelFilter.dispatchEvent(new KeyboardEvent('keydown', { key: 'خ', code: 'KeyO', altKey: true, bubbles: true, composed: true, cancelable: true }));
    return r.panelEl.hidden;
  }));
  // jump
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(100);
  const seq = [];
  // Until the smooth scroll has brought the annotation jumped to into view and stopped (slow on
  // the CI machine), then the note card's moment.
  const settled = () => page.waitForFunction(() => {
    const g = window.__hl.jumpGroup; const w = g && window.__hl.allWrappers().find(x => x.getAttribute('data-highlighter-group') === g);
    if (!w) return false;
    const t = w.getBoundingClientRect().top, ok = t >= 0 && t < innerHeight && window.__jumpTop === t;
    window.__jumpTop = t; return ok;
  }, null, { polling: 100, timeout: 5000 }).then(() => page.waitForTimeout(300));
  for (let i = 0; i < 6; i++) {
    await L.altKey(page, 'j'); await settled();
    seq.push(await page.evaluate(() => { const g = window.__hl.jumpGroup; const w = window.__hl.allWrappers().find(x => x.getAttribute('data-highlighter-group') === g); return [w.textContent, !window.__hl.noteCardEl.hidden, Math.round(w.getBoundingClientRect().top)]; }));
  }
  console.log(JSON.stringify(seq), await L.toast(page));
  L.check('jump order', seq.map(s => s[0]).join('|') === 'beta|three four|quick brown fox|Repeated words|*star* and _under_|beta', seq);
  L.check('jump shows note card for noted', seq[2][1] === true && seq[0][1] === false, seq);
  await L.altKey(page, 'k'); await settled();
  const back = await page.evaluate(() => window.__hl.jumpGroup);
  const backText = await page.evaluate(g => window.__hl.allWrappers().find(x => x.getAttribute('data-highlighter-group') === g).textContent, back);
  L.check('Alt+K wraps to last', backText === '*star* and _under_', backText);
  // Alt+N after jump edits the jumped one
  await page.mouse.move(1, 1);
  await L.altKey(page, 'n'); await page.waitForTimeout(150);
  const eg = await page.evaluate(() => window.__hl.editor && window.__hl.editor.group);
  L.check('Alt+N edits jumped annotation', eg === back, [eg, back]);
  await page.keyboard.press('Escape');
  // menu
  const menu = await page.evaluate(() => Object.keys(window.__menu));
  L.check('menu has new items', menu.includes('Show annotations') && menu.includes('Copy as Markdown'), menu);
  console.log('errors', page.__errors);
  L.check('no page errors', !page.__errors.length, page.__errors);
  await ctx.close(); await browser.close();
  console.log('FAILS', L.fails);
})();
