// 7.31: restyle or remove an annotation by pointing at it (no selection), with the jump fallback,
// stale-hover guards, pieces waiting to come back, dark backgrounds, and undo.
const L = require('./lib');
const CTX = 24;
function rec(xpath, block, text, { key = 'h', group, extra = {} } = {}) {
  const at = block.indexOf(text);
  if (at < 0) throw new Error('not in text: ' + text);
  return { xpath, startOffset: at, length: text.length, key, text, prefix: block.slice(Math.max(0, at - CTX), at), suffix: block.slice(at + text.length, at + text.length + CTX), group, ...extra };
}
const KEY = 'https://example.test/a';
const P1 = 'Paragraph alpha one is here with some words.';
const P2 = 'Paragraph beta two is here with other words.';
const P5 = 'Dark box gamma words live here.';
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:16px/1.5 serif;margin:40px">
<p id="p1">${P1}</p><p id="p2">${P2}</p>
<p id="p3">Start of <a href="#x" id="lnk">the linked words</a> and the end of it.</p>
<p id="p4">Plain text paragraph where nothing is annotated at all, long enough to point at.</p>
<div id="dark" style="background:#111;color:#eee;padding:8px"><p id="p5">${P5}</p></div>
<p id="p6">Filler.</p></body></html>`;
const recA = () => rec('//*[@id="p1"]', P1, 'alpha one', { group: 'gA', extra: { note: 'my note' } });
const recB = () => rec('//*[@id="p2"]', P2, 'beta two', { key: 'u', group: 'gB' });
const recD = () => rec('//*[@id="p5"]', P5, 'gamma words', { group: 'gD' });
const storeOf = (...recs) => ({ [KEY]: JSON.stringify(recs) });

const state = p => p.evaluate(() => window.__hl.allWrappers().map(w => {
  const svg = window.__hl.getSvg(w); const path = svg && svg.querySelector('path');
  return { k: w.getAttribute('data-style-key'), t: w.textContent, g: w.getAttribute('data-highlighter-group'), n: w.getAttribute('data-highlighter-note') || undefined,
    dark: w.hasAttribute('data-highlighter-dark'), stroke: path && path.getAttribute('stroke') };
}));
const keysOf = (s, g) => s.filter(w => w.g === g).map(w => w.k);
async function hover(p, group, i = 0) {
  const r = await p.evaluate(([g, i]) => {
    const ws = window.__hl.allWrappers().filter(w => w.getAttribute('data-highlighter-group') === g);
    const rect = ws[i].getClientRects()[0];
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, [group, i]);
  await p.mouse.move(r.x, r.y, { steps: 2 });
  await p.waitForTimeout(80);
}
async function hoverEl(p, sel, dx = 0.25) {
  const b = await p.locator(sel).boundingBox();
  await p.mouse.move(b.x + Math.min(b.width * dx, 60), b.y + b.height / 2, { steps: 2 });
  await p.waitForTimeout(80);
}
const watchPrevented = p => p.evaluate(() => { window.__prev = []; document.addEventListener('keydown', e => window.__prev.push([e.code, e.defaultPrevented])); });
const lastPrevented = p => p.evaluate(() => (window.__prev[window.__prev.length - 1] || [])[1]);
const results = [];
const check = (name, ok, info) => results.push([name, ok, info]);

async function basic(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: storeOf(recA(), recB()) });
  await watchPrevented(p);
  await hover(p, 'gA');
  await L.altKey(p, '2');
  let s = await state(p);
  let st = await L.stored(p);
  const a = st.find(r => r.group === 'gA');
  check('Alt+2 on a pointed yellow makes it green, note kept', keysOf(s, 'gA').join() === 'h2' && s.find(w => w.g === 'gA').n === 'my note', s);
  check('stored with the new style, same group, note and date', a && a.key === 'h2' && a.note === 'my note' && st.length === 2, st);
  check('key was taken (preventDefault)', (await lastPrevented(p)) === true, null);
  check('no toast for a restyle', (await L.toast(p)) === null, await L.toast(p));
  check('drawn with the green color', s.find(w => w.g === 'gA').stroke === '#8CE6F2', s);
  check('the other annotation is untouched', keysOf(s, 'gB').join() === 'u', s);
  await L.altKey(p, 'z');
  s = await state(p);
  check('Alt+Z brings the yellow back', keysOf(s, 'gA').join() === 'h' && (await L.stored(p)).find(r => r.group === 'gA').key === 'h', s);
  await L.altKey(p, 'y');
  s = await state(p);
  check('Alt+Y makes it green again', keysOf(s, 'gA').join() === 'h2', s);
  // Undo and redo drew it again: the mouse hasn't moved, and it still points at it.
  await L.altKey(p, '2');
  s = await state(p);
  st = await L.stored(p);
  check('its own style removes it (after undo/redo redrew it under a still mouse)', !s.some(w => w.g === 'gA') && !st.some(r => r.group === 'gA'), { s, st });
  check('removal offers Undo', (await L.toast(p)) === 'Removed cyan highlight · Undo', await L.toast(p));
  await p.evaluate(() => window.__hl.toastAction.click()); await p.waitForTimeout(150);
  s = await state(p);
  check('Undo brings it back with its note', keysOf(s, 'gA').join() === 'h2' && s.find(w => w.g === 'gA').n === 'my note', s);
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

async function multiPiece(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: storeOf(recA()) });
  await L.selStr(p, '#p3', 'of the linked');   // ends inside the link: one piece on each side of its edge
  await L.altKey(p, 'h');
  let s = await state(p);
  const g = s.find(w => w.t.includes('linked')).g;
  const pieces = s.filter(w => w.g === g).length;
  check('setup: one annotation in several pieces', pieces >= 2, s);
  await hover(p, g, 1);   // the piece inside the link
  await L.altKey(p, 'u');
  s = await state(p);
  check('Alt+U on one piece underlines every piece', keysOf(s, g).length === pieces && keysOf(s, g).every(k => k === 'u'), s);
  check('still one annotation', new Set((await L.stored(p)).filter(r => r.key === 'u').map(r => r.group)).size === 1, await L.stored(p));
  await L.altKey(p, 'Backspace');
  s = await state(p);
  check('Alt+Backspace on it removes every piece', !s.some(w => w.g === g) && keysOf(s, 'gA').join() === 'h', s);
  check('Undo toast for the removal', (await L.toast(p)) === 'Removed 1 annotation · Undo', await L.toast(p));
  await ctx.close();
}

async function noTarget(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: storeOf(recA(), recB()) });
  await watchPrevented(p);
  await hoverEl(p, '#p4');
  await L.altKey(p, '2');
  const s = await state(p);
  check('pointing at plain text: Alt+2 changes nothing', keysOf(s, 'gA').join() === 'h' && keysOf(s, 'gB').join() === 'u', s);
  check('pointing at plain text: the key stays the page\'s', (await lastPrevented(p)) === false, null);
  await L.altKey(p, 'Backspace');
  check('pointing at plain text: Alt+Backspace changes nothing and stays the page\'s', (await state(p)).length === 2 && (await lastPrevented(p)) === false, null);
  // The mouse leaves the window from an annotation.
  await hover(p, 'gA');
  await p.evaluate(() => document.querySelector('[data-highlighter-group="gA"]').dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null })));
  await L.altKey(p, '4');
  check('mouse out of the window: nothing pointed at', keysOf(await state(p), 'gA').join() === 'h', await state(p));
  await ctx.close();
}

async function hidden(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: storeOf(recA()) });
  await watchPrevented(p);
  await hover(p, 'gA');
  await L.altKey(p, 'v');
  await L.altKey(p, '4');
  let s = await state(p);
  check('hidden: Alt+4 on a pointed annotation does nothing', keysOf(s, 'gA').join() === 'h' && (await p.evaluate(() => window.__hl.annotationsHidden)) === true, s);
  check('hidden: the key stays the page\'s', (await lastPrevented(p)) === false, null);
  await L.altKey(p, 'Backspace');
  check('hidden: Alt+Backspace on it does nothing', keysOf(await state(p), 'gA').join() === 'h', await state(p));
  await L.altKey(p, 'n');
  check('hidden: Alt+N still opens its note, as before', (await p.evaluate(() => window.__hl.editor && window.__hl.editor.group)) === 'gA', null);
  await ctx.close();
}

async function panelHover(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: storeOf(recA()) });
  await hover(p, 'gA');
  await L.altKey(p, 'o');
  const b = await p.evaluate(() => { const r = window.__hl.panelEl.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 20 }; });
  await p.mouse.move(b.x, b.y, { steps: 3 }); await p.waitForTimeout(100);
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await L.altKey(p, '2');
  check('mouse over the panel points at no annotation', keysOf(await state(p), 'gA').join() === 'h', { s: await state(p), hovered: await p.evaluate(() => !!window.__hl.hoveredWrapper) });
  await ctx.close();
}

async function jumpFallback(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: storeOf(recA(), recB()) });
  await hoverEl(p, '#p4');
  await L.altKey(p, 'j');
  await p.waitForTimeout(600);
  const jumped = await p.evaluate(() => window.__hl.jumpGroup);
  await L.altKey(p, '4');
  const s = await state(p);
  check('after Alt+J, a style key restyles the annotation jumped to', jumped && keysOf(s, jumped).join() === 'h4', { jumped, s });
  await ctx.close();
}

async function noteCard(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: storeOf(recA()) });
  await hover(p, 'gA');
  await p.waitForTimeout(400);
  const card = await p.evaluate(() => { const c = window.__hl.noteCardEl; if (c.hidden) return null; const r = c.getBoundingClientRect(); return { x: r.left + 20, y: r.top + 10 }; });
  check('setup: the note card shows', !!card, card);
  if (card) {
    await p.mouse.move(card.x, card.y, { steps: 3 }); await p.waitForTimeout(100);
    await L.altKey(p, '2');
    const s = await state(p);
    check('mouse on the note card: Alt+2 restyles its annotation', keysOf(s, 'gA').join() === 'h2' && s[0].n === 'my note', s);
    await L.altKey(p, '2');
    check('and its own style removes it, closing the card', (await state(p)).length === 0 && (await p.evaluate(() => window.__hl.noteCardEl.hidden)), { s: await state(p) });
  }
  await ctx.close();
}

async function selectionWins(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: storeOf(recA(), recB()) });
  await hover(p, 'gA');
  await L.selStr(p, '#p4', 'Plain text');
  await L.altKey(p, '4');
  const s = await state(p);
  check('with a selection, the key acts on the selection, not on the pointed annotation', keysOf(s, 'gA').join() === 'h' && s.some(w => w.t === 'Plain text' && w.k === 'h4'), s);
  await ctx.close();
}

async function waitingPiece(browser) {
  // One annotation, one piece on the page and one waiting for text that isn't there.
  const present = rec('//*[@id="p2"]', P2, 'other words', { group: 'gP' });
  const waiting = { xpath: '//*[@id="gone"]', startOffset: 0, length: 12, key: 'h', text: 'missing text', prefix: '', suffix: '', group: 'gP' };
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: storeOf(present, waiting) });
  await hover(p, 'gP');
  await L.altKey(p, '2');
  const st = await L.stored(p);
  check('the waiting piece takes the new style too', st.length === 2 && st.every(r => r.key === 'h2' && r.group === 'gP'), st);
  await L.altKey(p, '2');
  check('its own style removes the waiting piece as well', (await L.stored(p)).length === 0, await L.stored(p));
  await ctx.close();
}

async function legacyWaiting(browser) {
  // A record saved before groups existed (no group) placed, plus its waiting twin: restyling keeps
  // them one annotation.
  const placed = rec('//*[@id="p2"]', P2, 'other words', {});
  delete placed.group;
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: storeOf(placed) });
  const g = (await state(p))[0].g;
  await hover(p, g);
  await L.altKey(p, '4');
  const st = await L.stored(p);
  check('a legacy annotation keeps its derived group when restyled', st.length === 1 && st[0].key === 'h4' && st[0].group === g, { st, g });
  await ctx.close();
}

async function dark(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: storeOf(recD()) });
  await hover(p, 'gD');
  await L.altKey(p, '2');
  const s = await state(p);
  check('on a dark box the new style uses its dark color', s[0].k === 'h2' && s[0].dark && s[0].stroke === '#006D7A', s);
  await ctx.close();
}

async function editorOther(browser) {
  // A note being written on another annotation closes first and is offered back.
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: storeOf(recA(), recB()) });
  await hover(p, 'gB');
  await L.altKey(p, 'n');
  await p.keyboard.type('draft for B');
  await p.evaluate(() => document.body.focus());   // focus back on the page, editor still open
  await p.evaluate(() => { const h = window.__hl.uiHost; if (document.activeElement === h) h.blur(); });
  await hover(p, 'gA');
  await L.altKey(p, '2');
  const s = await state(p);
  const ed = await p.evaluate(() => window.__hl.editor);
  check('editor on another annotation closes, restyle applies', keysOf(s, 'gA').join() === 'h2' && !ed, { s, ed });
  check('its text is offered back', (await L.toast(p)) === 'Note not saved · Restore', await L.toast(p));
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([basic, multiPiece, noTarget, hidden, panelHover, jumpFallback, noteCard, selectionWins, waitingPiece, legacyWaiting, dark, editorOther]
    .map(f => f(browser).catch(e => check(`${f.name} crashed`, false, e.stack))));
  await browser.close();
  let fails = 0;
  results.forEach(([name, ok, info]) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + JSON.stringify(info)}`); if (!ok) fails++; });
  console.log(`FAILS ${fails}`);
  process.exit(fails);
})();
