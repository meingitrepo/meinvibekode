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
  check('and a Delete button', await p.evaluate(() => !window.__hl.noteCardEl.hidden && window.__hl.cardDelete.getAttribute('aria-label') === 'Delete note (Alt+D)'), null);
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
  await p.evaluate(() => window.__hl.cardDelete.click()); await p.waitForTimeout(150);
  let w = (await L.wr(p)).filter(x => x.g === 'gA');
  check('Delete removes the note and keeps the annotation', w.length === 1 && !w[0].n && (await card(p)) === null, w);
  check('with an Undo message', (await L.toast(p)) === 'Deleted note · Undo', await L.toast(p));
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
  await Promise.all([delay, placement, del].map(f => f(browser).catch(e => check(`${f.name} crashed`, false, e.stack))));
  await browser.close();
  let fails = 0;
  results.forEach(([name, ok, info]) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + JSON.stringify(info)}`); if (!ok) fails++; });
  console.log(`FAILS ${fails}`);
  process.exit(fails);
})();
