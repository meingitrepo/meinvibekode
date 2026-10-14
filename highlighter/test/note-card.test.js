// 7.32 item 5: note card delay, placement at the line under the pointer, Delete in its footer.
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
const card = p => p.evaluate(() => { const r = window.__hl; if (r.noteCardEl.hidden) return null; const b = r.noteCardEl.getBoundingClientRect(); return { text: r.cardText.textContent, hint: r.cardHint.textContent, top: b.top, bottom: b.bottom }; });
const center = r => [(r.left + r.right) / 2, (r.top + r.bottom) / 2];

async function delay(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  const a = (await L.rects(p, '#p1', 'alpha note'))[0];
  await p.mouse.move(...center(a));
  await p.waitForTimeout(120);
  check('no card right away', (await card(p)) === null, await card(p));
  await p.waitForTimeout(350);
  const c = await card(p);
  check('the card shows after resting on the note', c && c.text === 'Note A', c);
  check('its footer has the date', c && /^Added .*2026/.test(c.hint), c);
  check('and a Delete button', await p.evaluate(() => !window.__hl.noteCardEl.hidden && window.__hl.cardDelete.getAttribute('aria-label') === 'Delete note'), null);
  const b = (await L.rects(p, '#p3', 'beta note'))[0];
  await p.mouse.move(...center(b));   // straight there: with steps it would cross the long note
  await p.waitForTimeout(80);
  const c2 = await card(p);
  check('with a card open, another note switches at once', c2 && c2.text === 'Note B', c2);
  await p.mouse.move(5, 5); await p.waitForTimeout(400);
  check('moving off hides it', (await card(p)) === null, await card(p));
  // passing over a note on the way elsewhere
  await p.mouse.move(...center(a)); await p.waitForTimeout(100); await p.mouse.move(5, 300); await p.waitForTimeout(450);
  check('passing over a note opens nothing', (await card(p)) === null, await card(p));
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

async function placement(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  const lines = await L.rects(p, '#p2', LONG);
  const ok = lines.length >= 4;
  check('the long annotation spans several lines', ok, lines.length);
  await p.mouse.move(...center(lines[1])); await p.waitForTimeout(500);
  const c = await card(p);
  const below = lines[1].bottom, whole = lines[lines.length - 1].bottom;
  check('the card sits under the line the pointer is on, not under the whole annotation', c && c.top >= below && c.top < below + 20 && c.top < whole, { c, below, whole });
  await ctx.close();
}

async function del(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store });
  const a = (await L.rects(p, '#p1', 'alpha note'))[0];
  await p.mouse.move(...center(a)); await p.waitForTimeout(500);
  await p.evaluate(() => window.__hl.cardDelete.click()); await p.waitForTimeout(150);
  let w = (await L.wr(p)).filter(x => x.g === 'gA');
  check('Delete removes the note and keeps the annotation', w.length === 1 && !w[0].n && (await card(p)) === null, w);
  check('with an Undo message', (await L.toast(p)) === 'Note deleted · Undo', await L.toast(p));
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
