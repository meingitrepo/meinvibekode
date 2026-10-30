// 7.29: note badge (8.13; was a tick), toast theme and focus, gradient backgrounds,
// a new note's highlight on SPA navigation / turn off / menu commands.
const L = require('./lib');
const long = Array.from({ length: 60 }, (_, i) => `Sentence ${i} of a very long paragraph that keeps going for a while.`).join(' ');
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title><style>
  body { background:#fff; color:#111; font:16px/1.6 sans-serif; margin:40px; max-width: 700px } pre { background:#1e1e1e; color:#ddd; padding:12px }
  h1 { font-size: 32px }
</style></head><body>
<h1 id="h">A heading with a note</h1>
<p id="p1">Light paragraph one with words to select and some more words after them to make two lines of text here.</p>
<pre id="pre1">const darkCode = true; // a dark block</pre>
<p id="p2">Shared phrase lives here on page A.</p>
<p id="long">${long}</p>
<button id="btn">page button</button> <a id="lnk" href="#frag">page link</a>
${Array.from({ length: 30 }, (_, i) => `<p>Filler ${i} keeps the middle of the view white.</p>`).join('')}
<section id="hero" style="background-image:linear-gradient(135deg,#0f172a,#1e293b);color:#f8fafc;padding:40px"><span id="hs">Ship faster with our platform</span></section>
</body></html>`;
const tbRect = page => L.toolbar(page).then(t => t && t.rect);
(async () => {
  const browser = await L.launch();
  {
    const { ctx, page } = await L.open(browser, { html: HTML });
    // (where the toolbar goes is checked in toolbar-place.test.js)
    await L.selStr(page, '#p1', 'words to select');
    await page.waitForTimeout(400);
    let t = await tbRect(page);
    await page.evaluate(() => window.scrollTo(0, document.querySelector('#long').offsetTop - 100));
    await L.selStr(page, '#long', 'Sentence 1 ', { endStr: 'Sentence 3 of' });
    await page.waitForTimeout(400);
    t = await tbRect(page);
    const last = await page.evaluate(() => { const r = getSelection().getRangeAt(0); const rs = Array.from(r.getClientRects()).filter(x => x.width); return { first: rs[0].top, top: rs[rs.length - 1].top, bottom: rs[rs.length - 1].bottom }; });
    L.check('multi-line selection spans lines', last.top > last.first, last);
    // backward multi-line: above the first line
    await L.selStr(page, '#long', 'Sentence 1 ', { endStr: 'Sentence 3 of', backward: true });
    await page.waitForTimeout(400);
    t = await tbRect(page);
    L.check('backward: toolbar above the first line', t && t.bottom <= last.first, { t, last });
    // a selection taller than the view: the toolbar stays on screen
    await page.evaluate(() => window.scrollTo(0, document.querySelector('#long').offsetTop - 50));
    await L.selStr(page, '#long', 'Sentence 0', { endStr: 'Sentence 59 of a very long paragraph that keeps going for a while.' });
    await page.waitForTimeout(400);
    t = await tbRect(page);
    L.check('tall selection: toolbar on screen', t && t.top >= 0 && t.bottom <= 700, t);
    await page.mouse.wheel(0, 300); await page.waitForTimeout(300);
    t = await tbRect(page);
    L.check('after scrolling: still on screen', !t || (t.top >= 0 && t.bottom <= 700), t);
    await page.evaluate(() => { getSelection().removeAllRanges(); window.scrollTo(0, 0); });
    await page.waitForTimeout(300);
    // note badge: zero net width, grows with the font, rim in the background's color
    await L.selStr(page, '#h', 'heading'); await L.altKey(page, 'n'); await page.keyboard.type('n'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
    await L.selStr(page, '#p1', 'words'); await L.altKey(page, 'n'); await page.keyboard.type('n'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
    await L.selStr(page, '#pre1', 'darkCode'); await L.altKey(page, 'n'); await page.keyboard.type('n'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
    const badges = await page.evaluate(() => Array.from(document.querySelectorAll('span[data-highlighter-note-mark]')).map(w => { const s = getComputedStyle(w, '::after'); return { t: w.textContent, w: s.width, ml: s.marginLeft, bg: s.getPropertyValue('--highlighter-badge-fill').trim(), ring: s.getPropertyValue('--highlighter-badge-rim').trim(), img: s.backgroundImage }; }));
    const badge = t => badges.find(x => x.t === t);
    L.check('badge 14px at 16px, zero net width', badge('words').w === '14px' && badge('words').ml === '-14px', badges);
    L.check('the badge is the Phosphor chat icon, as an image', /^url\("data:image\/svg\+xml,/.test(badge('words').img) && decodeURIComponent(badge('words').img).includes('M132,24A100.11'), badge('words').img);
    L.check('badge grows on a heading', parseFloat(badge('heading').w) > 24, badges);
    L.check('badge in its highlight color with a white rim on light', badge('words').bg === '#EFD98A' && badge('words').ring === '#ffffff', badges);
    L.check('badge in the dark highlight color with a dark rim on dark', badge('darkCode').bg === '#6F5614' && badge('darkCode').ring === '#1b1b1b', badges);
    await L.selStr(page, '#p1', 'words'); await L.altKey(page, 'n'); await page.waitForTimeout(150);
    await page.evaluate(() => getSelection().removeAllRanges()); await page.waitForTimeout(300);
    const editing = await page.evaluate(() => Array.from(document.querySelectorAll('span[data-highlighter-note-mark]')).map(w => [w.textContent, getComputedStyle(w, '::after').getPropertyValue('--highlighter-badge-fill').trim()]));
    L.check('badge in the outline color while its note is edited (8.42)', editing.find(x => x[0] === 'words')[1] === '#000000' && editing.find(x => x[0] === 'heading')[1] === '#EFD98A', editing);
    const outlined = await page.evaluate(() => ({ boxes: window.__hl.selectBoxesEl.querySelectorAll('.select-box:not([hidden])').length, tb: !window.__hl.toolbarEl.hidden }));
    L.check('editing draws the dashed outline, no toolbar', outlined.boxes === 1 && !outlined.tb, outlined);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    L.check('back to its color and no outline after', await page.evaluate(() => Array.from(document.querySelectorAll('span[data-highlighter-note-mark]')).every(w => getComputedStyle(w, '::after').getPropertyValue('--highlighter-badge-fill').trim() !== '#000000') && !window.__hl.selectBoxesEl.querySelector('.select-box')), null);
    const wb = await page.evaluate(() => { const r = Array.from(document.querySelectorAll('span[data-highlighter-note-mark]')).find(w => w.textContent === 'words').getBoundingClientRect(); return [r.left + 3, r.top + r.height / 2]; });
    await page.mouse.click(...wb); await page.waitForTimeout(100);
    L.check('badge in the outline color while selected (8.42)', await page.evaluate(() => { const w = Array.from(document.querySelectorAll('span[data-highlighter-note-mark]')).find(w => w.textContent === 'words'); return getComputedStyle(w, '::after').getPropertyValue('--highlighter-badge-fill').trim() === '#000000'; }), null);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    L.check('badge adds no text', !/n$/.test(badge('words').t), badges);
    // toast theme stays when the toolbar opens on a dark block
    await page.evaluate(() => window.__hl.showToast('Theme check'));
    await page.waitForTimeout(200);
    const theme = () => page.evaluate(() => ({ toast: window.__hl.toastEl.hidden ? null : window.__hl.toastEl.getAttribute('data-theme'), host: window.__hl.uiHost.getAttribute('data-theme'), tb: !window.__hl.toolbarEl.hidden }));
    const a = await theme();
    await L.selStr(page, '#pre1', 'darkCode'); await page.waitForTimeout(500);
    const b = await theme();
    L.check('toolbar on a dark block is dark, the toast stays light', a.toast === 'light' && b.toast === 'light' && b.host === 'dark' && b.tb, { a, b });
    const toastBg = await page.evaluate(() => getComputedStyle(window.__hl.toastEl).backgroundColor);
    L.check('toast background light', toastBg === 'rgb(250, 249, 245)', toastBg);
    // Toast: a tooltip-like text line (no leading icon), focusable container
    const tf = await page.evaluate(() => { const t = window.__hl.toastEl; return { icon: getComputedStyle(t.querySelector(':scope > .icon')).display, tab: t.getAttribute('tabindex') }; });
    L.check('toast shows no leading icon, container is focusable', tf.icon === 'none' && tf.tab === '-1', tf);
    await page.evaluate(() => getSelection().removeAllRanges());
    // gradient hero: dark colors
    await page.evaluate(() => document.querySelector('#hero').scrollIntoView());
    await L.selStr(page, '#hs', 'Ship faster'); await L.altKey(page, 'h');
    const dark = await page.evaluate(() => window.__hl.allWrappers().find(w => w.textContent === 'Ship faster').hasAttribute('data-highlighter-dark'));
    L.check('highlight on a dark gradient gets dark colors', dark, dark);
    L.check('no page errors', page.__errors.length === 0, page.__errors);
    await ctx.close();
  }
  {
    // keyboard focus returns after the toast's button
    const { ctx, page } = await L.open(browser, { html: HTML });
    await L.selStr(page, '#p1', 'words to select'); await L.altKey(page, 'h');
    await L.altKey(page, 'v');
    await page.focus('#lnk'); await page.keyboard.press('Tab'); await page.waitForTimeout(100);
    const inToast = await page.evaluate(() => window.__hl.toastEl.contains(window.__hl.uiRoot.activeElement));
    await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    const after = await page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
    const w = await L.wr(page);
    L.check('Tab reaches the toast', inToast, inToast);
    L.check('focus back on the link after Show', after === 'lnk' && w.length === 1 && w[0].t === 'words to select', { after, w });
    await ctx.close();
  }
  const startNote = async p => { await L.selStr(p, '#p2', 'Shared phrase'); await L.altKey(p, 'n'); await p.keyboard.type('half-written note'); };
  const bare = s => s.filter(r => r.text === 'Shared phrase' && !r.note);
  const store = { 'https://example.test/a': JSON.stringify([{ xpath: '/html/body/p[9]', startOffset: 0, length: 9, key: 'h', text: 'Not here!', prefix: 'x', suffix: 'y', group: 'gm' }]) };
  {
    const { ctx, page } = await L.open(browser, { html: HTML, store });
    await startNote(page);
    await page.evaluate(() => { history.pushState({}, '', '/b'); document.body.innerHTML = '<p>Welcome to page B.</p>'; }); await page.waitForTimeout(900);
    const s = await L.stored(page);
    L.check('SPA navigation drops the new note\'s highlight', bare(s).length === 0 && s.some(r => r.text === 'Not here!'), s);
    await ctx.close();
  }
  {
    const { ctx, page } = await L.open(browser, { html: HTML, store, wait: 1200 });
    await startNote(page);
    await page.evaluate(() => window.__menu[Object.keys(window.__menu).find(k => /^Forget/.test(k))]()); await page.waitForTimeout(150);
    let s = await L.stored(page);
    L.check('menu Forget with a note open: no bare highlight, no erase message', bare(s).length === 0 && !s.some(r => r.text === 'Not here!') && !/erased/.test(await L.toast(page) || ''), { s, t: await L.toast(page) });
    await L.altKey(page, 'z');
    s = await L.stored(page);
    L.check('Alt+Z still undoes the forget', s.some(r => r.text === 'Not here!') && bare(s).length === 0, s);
    await ctx.close();
  }
  {
    const { ctx, page } = await L.open(browser, { html: HTML, store, wait: 1200 });
    await L.selStr(page, '#p1', 'words to select'); await L.altKey(page, 'h');
    await startNote(page);
    await page.evaluate(() => window.__menu[Object.keys(window.__menu).find(k => /^Clear/.test(k))]()); await page.waitForTimeout(150);
    let s = await L.stored(page);
    L.check('menu Clear with a note open: all gone, Undo offered', s.length === 0 && /erased · Undo$/.test(await L.toast(page) || ''), { s, t: await L.toast(page) });
    await L.altKey(page, 'z');
    s = await L.stored(page);
    L.check('Alt+Z undoes the clear without the note\'s highlight', bare(s).length === 0 && s.some(r => r.text === 'words to select'), s);
    await ctx.close();
  }
  await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
