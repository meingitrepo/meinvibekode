// 7.32 item 5: note card delay and Delete in its footer; 8.17: the card opens at the note badge; 8.32: by hovering the badge.
const L = require('./lib');
const CTX = 24;
function rec(xpath, block, text, { key = 'h', group, extra = {} } = {}) {
  const at = block.indexOf(text);
  return { xpath, startOffset: at, length: text.length, key, text, prefix: block.slice(Math.max(0, at - CTX), at), suffix: block.slice(at + text.length, at + text.length + CTX), group, ...extra };
}
const KEY = 'https://example.test/a';
const P1 = 'Short first paragraph with alpha note words in it.';
const LONG = 'This long annotated passage runs over several lines of the narrow column so that the note card has to choose which line it sits under when the pointer rests on one of them, and it keeps going a little longer still.';
const P2 = `Lead in. ${LONG} Trailing words.`;
const P3 = 'Third paragraph with beta note words in it.';
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px;max-width:360px">
<p id="p1">${P1}</p><p id="p2">${P2}</p><p id="p3">${P3}</p></body></html>`;
const ADDED = Date.UTC(2026, 0, 15, 12);
const store = { [KEY]: JSON.stringify([
  rec('//*[@id="p1"]', P1, 'alpha note', { group: 'gA', extra: { note: 'Note A', added: ADDED } }),
  rec('//*[@id="p2"]', P2, LONG, { group: 'gL', extra: { note: 'Long note' } }),
  rec('//*[@id="p3"]', P3, 'beta note', { group: 'gB', extra: { note: 'Note B' } })]) };
const results = [];
const check = (name, ok, info) => results.push([name, ok, info]);
// Measured once its opening animation (a 4px slide) has finished, so a card that opened a few ms
// later doesn't read as moved.
const card = p => p.evaluate(async () => { const r = window.__hl; if (r.noteCardEl.hidden) return null; await Promise.all(r.noteCardEl.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))); const b = r.noteCardEl.getBoundingClientRect(); return { text: r.cardText.textContent, hint: r.cardHint.textContent, top: b.top, bottom: b.bottom }; });

async function delay(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  const a = (await L.rects(p, '#p1', 'alpha note'))[0];
  await p.mouse.move(a.left + 3, (a.top + a.bottom) / 2); await p.waitForTimeout(450);
  check('resting on the annotation away from its badge opens nothing', (await card(p)) === null, await card(p));
  const [bx, by] = await L.badge(p, 'gA');
  await p.mouse.move(bx + 12, by);   // just beside the badge
  await p.waitForTimeout(120);
  check('no card right away', (await card(p)) === null, await card(p));
  await p.waitForTimeout(350);
  const c = await card(p);
  check('the card shows after resting near the badge', c && c.text === 'Note A', c);
  check('its footer has the date', c && /^Added .*2026/.test(c.hint), c);
  check('and only a pin button', await p.evaluate(() => !window.__hl.noteCardEl.hidden && window.__hl.noteCardEl.querySelectorAll('.card-actions button').length === 1), null);
  await p.mouse.move(...await L.badge(p, 'gB'));   // straight there: with steps it would cross the long note
  await p.waitForTimeout(80);
  const c2 = await card(p);
  check('with a card open, another note switches at once', c2 && c2.text === 'Note B', c2);
  await p.mouse.move(5, 5); await p.waitForTimeout(400);
  check('moving off hides it', (await card(p)) === null, await card(p));
  // 8.33: from the badge into the card and out to the page, the card still hides (it stuck open)
  await p.mouse.move(bx, by); await p.waitForTimeout(450);
  const cb = await p.evaluate(() => { const r = window.__hl.noteCardEl.getBoundingClientRect(); return [r.left + 20, r.top + 10]; });
  await p.mouse.move(...cb, { steps: 4 }); await p.waitForTimeout(100);
  check('setup: the card stays while the mouse is on it', !!(await card(p)), await card(p));
  await p.mouse.move(5, 300, { steps: 4 }); await p.waitForTimeout(400);
  check('leaving the card for the page hides it', (await card(p)) === null, await card(p));
  // passing over a note on the way elsewhere
  await p.mouse.move(bx, by); await p.waitForTimeout(100); await p.mouse.move(5, 300); await p.waitForTimeout(450);
  check('passing over a badge opens nothing', (await card(p)) === null, await card(p));
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

// 8.34: the card's pin button keeps its note open, the badge blue (8.42); the pinned copy's pin button or Esc (8.35) lets it go.
// 8.38: clicks elsewhere keep it; it drags by its footer; the editor does not move, and opening it unpins its note.
// 8.39: several can be pinned; a pinned note scrolls away with its badge; clicking outside the editor keeps it.
const DARKER = 'rgb(217, 119, 87)';   // 9.2: pinned badges are clay, the Anthropic accent
async function pin(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  await p.evaluate(() => { document.body.style.paddingBottom = '2000px'; });
  const fill = g => p.evaluate(g => { const m = Array.from(document.querySelectorAll('[data-highlighter-note-pin]')).find(m => m.getAttribute('data-highlighter-group') === g); return m && getComputedStyle(m, '::after').backgroundColor; }, g);
  const pins = () => p.evaluate(() => Array.from(window.__hl.uiRoot.querySelectorAll('.card[data-pinned]')).map(c => { const b = c.getBoundingClientRect(); return { text: c.querySelector('.card-text').textContent, x: b.left, y: b.top }; }));
  const rect = sel => p.evaluate(s => { const b = window.__hl.uiRoot.querySelector(s).getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }, sel);
  const drag = async (sel, dx, dy) => { const h = await rect(sel); await p.mouse.move(h.x + 4, h.y + h.h / 2); await p.mouse.down(); await p.mouse.move(h.x + 4 + dx, h.y + h.h / 2 + dy, { steps: 5 }); await p.mouse.up(); };
  const [bx, by] = await L.badge(p, 'gA');
  const hoverPin = async g => { await p.mouse.move(...await L.badge(p, g)); await p.waitForFunction(() => !window.__hl.noteCardEl.hidden); await p.evaluate(() => window.__hl.noteCardEl.querySelector('.card-actions button').click()); await p.waitForTimeout(50); };
  await hoverPin('gA');
  let ps = await pins();
  check('the card\'s pin button pins its note at once', ps.length === 1 && ps[0].text === 'Note A', ps);
  check('the clicked badge turns clay', (await fill('gA')) === DARKER, await fill('gA'));
  check('and the annotation is not selected', await p.evaluate(() => !window.__hl.selectedGroups.length), null);
  await p.mouse.move(5, 300, { steps: 4 }); await p.waitForTimeout(400);
  await p.mouse.click(5, 300); await p.waitForTimeout(50);
  check('moving away and clicking elsewhere keep it', (await pins()).length === 1 && (await fill('gA')) === DARKER, await pins());
  await hoverPin('gB');
  check('pinning a note does not fade it in again; the copy only lifts its shadow (no stacked dark flash)', await p.evaluate(() => Array.from(window.__hl.uiRoot.querySelectorAll('.card[data-pinned]')).map(c => getComputedStyle(c).animationName).join() === 'highlighter-pin,highlighter-pin'), await p.evaluate(() => Array.from(window.__hl.uiRoot.querySelectorAll('.card[data-pinned]')).map(c => getComputedStyle(c).animationName).join()));
  ps = await pins();
  check('another note pins a second one', ps.length === 2 && ps.map(c => c.text).sort().join() === 'Note A,Note B' && (await fill('gB')) === DARKER, ps);
  await p.mouse.move(5, 300); await p.mouse.wheel(0, 500); await p.waitForTimeout(200);
  const ps2 = await pins();
  check('pinned notes scroll away with their badges', ps2.every((c, i) => Math.abs(ps[i].y - c.y - 500) < 3 && c.x === ps[i].x), { ps, ps2 });
  await p.mouse.wheel(0, -500); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(50);
  ps = await pins();
  check('Esc closes the last one pinned', ps.length === 1 && ps[0].text === 'Note A' && (await fill('gB')) == null, ps);
  const eb = await rect('.card[data-pinned] .card-actions button');
  await p.mouse.move(eb.x + eb.w / 2, eb.y + eb.h / 2); await p.waitForTimeout(400);
  check('a pinned card\'s buttons have their tooltips', await p.evaluate(() => !window.__hl.labelTipEl.hidden && window.__hl.labelTipEl.textContent.startsWith('Unpin note')), await p.evaluate(() => window.__hl.labelTipEl.textContent));
  const c0 = (await pins())[0];
  await drag('.card[data-pinned] .card-footer', 60, 80);
  const c1 = (await pins())[0];
  check('a pinned card drags by its footer', Math.abs(c1.x - c0.x - 60) < 2 && Math.abs(c1.y - c0.y - 80) < 2, { c0, c1 });
  await p.evaluate(() => window.__hl.uiRoot.querySelector('.card[data-pinned] .card-actions button').click()); await p.waitForTimeout(50);
  check('the pinned card\'s pin button closes it', (await pins()).length === 0 && (await fill('gA')) == null, await pins());
  await hoverPin('gA');
  await drag('.card[data-pinned] .card-footer', 40, 60);
  const an = (await L.rects(p, '#p1', 'alpha note'))[0];
  await p.mouse.move(an.left + 3, (an.top + an.bottom) / 2); await p.waitForTimeout(200);
  await L.altKey(p, 'n');
  await L.until(p, () => !window.__hl.editorEl.hidden);
  await p.evaluate(() => Promise.all(window.__hl.editorEl.getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))));
  check('opening the editor closes the pinned card', (await pins()).length === 0, await pins());
  const e0 = await rect('.editor');
  await drag('.editor-header', -30, 50);
  const e1 = await rect('.editor');
  check('the editor does not drag by its header', e1.x === e0.x && e1.y === e0.y, { e0, e1 });
  await p.evaluate(() => window.__hl.noteInput.focus());
  await p.keyboard.type(' more');
  await p.mouse.click(5, 300); await p.waitForTimeout(100);
  check('clicking outside the editor keeps it, with what was typed', await p.evaluate(() => !window.__hl.editorEl.hidden && window.__hl.noteInput.value === 'Note A more'), null);
  const outlined = () => p.evaluate(() => window.__hl.selectedGroups.join() === 'gA' && !!window.__hl.selectBoxesEl.querySelector('.select-box:not([hidden])'));
  check('and its annotation keeps the dashed outline', await outlined(), null);
  await L.selStr(p, '#p3', 'Third paragraph'); await p.waitForTimeout(100);
  check('selecting text keeps the outline too', await outlined(), null);
  await p.evaluate(() => getSelection().removeAllRanges());
  const bn = (await L.rects(p, '#p3', 'beta note'))[0];
  await p.mouse.click(bn.left + 3, (bn.top + bn.bottom) / 2); await p.waitForTimeout(100);
  check('clicking another annotation does not select it while editing', await outlined() && (await p.evaluate(() => window.__hl.selectBoxesEl.querySelectorAll('.select-box').length)) === 1, await p.evaluate(() => window.__hl.selectedGroups));
  check('Save is enabled with unsaved changes', await p.evaluate(() => !window.__hl.uiRoot.querySelector('.editor .btn').disabled), null);
  await p.keyboard.press('Escape'); await p.waitForTimeout(50);
  check('Esc still discards it', await p.evaluate(() => window.__hl.editorEl.hidden), null);
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

async function placement(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  const lines = await L.rects(p, '#p2', LONG);
  const ok = lines.length >= 4;
  check('the long annotation spans several lines', ok, lines.length);
  await p.mouse.move(...await L.badge(p, 'gL')); await p.waitForTimeout(500);
  const c = await card(p);
  const last = lines[lines.length - 1];
  const at = await p.evaluate(() => { const b = window.__hl.noteCardEl.getBoundingClientRect(); return { left: b.left, right: b.right }; });
  check('the card sits under the last line, where the note badge is', c && c.top >= last.bottom && c.top < last.bottom + 20, { c, last });
  check('centred on the badge at the end of that line', at && Math.abs((at.left + at.right) / 2 - last.right) < 2 || (at && at.left <= 4), { at, last });
  await ctx.close();
}

async function del(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  await p.mouse.move(...await L.badge(p, 'gA')); await p.waitForTimeout(500);
  const an = (await L.rects(p, '#p1', 'alpha note'))[0];
  await p.mouse.move(an.left + 3, (an.top + an.bottom) / 2); await p.waitForTimeout(200);
  await L.altKey(p, 'd'); await p.waitForTimeout(150);
  let w = (await L.wr(p)).filter(x => x.g === 'gA');
  check('Delete removes the note and keeps the annotation', w.length === 1 && !w[0].n && (await card(p)) === null, w);
  check('no toast', (await L.toast(p)) === null, await L.toast(p));
  const s = (await L.stored(p)).find(r => r.group === 'gA');
  check('and it is saved', s && !s.note, s);
  await L.altKey(p, 'z');
  w = (await L.wr(p)).filter(x => x.g === 'gA');
  check('Undo brings the note back', w.length === 1 && w[0].n === 'Note A', w);
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([delay, pin, placement, del].map(f => f(browser).catch(e => check(`${f.name} crashed`, false, e.stack))));
  await browser.close();
  let fails = 0;
  results.forEach(([name, ok, info]) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + JSON.stringify(info)}`); if (!ok) fails++; });
  console.log(`FAILS ${fails}`);
  process.exit(fails);
})();
