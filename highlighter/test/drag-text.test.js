// 8.25 (from review): dragging the selected text ends without a mouseup; its annotations stay marked.
const L = require('./lib');
const CTX = 24;
const rec = (xpath, text, word, key, g) => { const at = text.indexOf(word);
  return { xpath, startOffset: at, length: word.length, key, text: word, prefix: text.slice(Math.max(0, at - CTX), at), suffix: text.slice(at + word.length, at + word.length + CTX), group: `g${g}` }; };
const frames = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
async function settle(p) { await frames(p); await p.waitForTimeout(50); await frames(p); }
const T1 = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango';
const html = `<!doctype html><html><body style="font:18px/1.6 serif;margin:40px;max-width:430px"><p id="p">${T1}</p></body></html>`;
const recs = [ rec('//*[@id="p"]', T1, 'charlie delta echo foxtrot', 'h', 1), rec('//*[@id="p"]', T1, 'kilo lima mike', 'u', 2) ];
const state = p => p.evaluate(() => ({ sel: getSelection().toString(), marks: document.querySelectorAll('[data-highlighter-selected-part]').length,
  masked: document.querySelectorAll('path[mask]').length, drags: window.__drags }));
(async () => {
  const b = await L.launch();
  const { page: p } = await L.open(b, { html, store: { 'https://example.test/a': JSON.stringify(recs) } });
  await p.waitForFunction(n => window.__hl.allWrappers().length >= n, recs.length); await p.waitForTimeout(400);
  await p.evaluate(() => { window.__drags = []; ['dragstart', 'dragend', 'mouseup'].forEach(t => document.addEventListener(t, () => window.__drags.push(t), true)); });
  await L.selStr(p, '#p', 'bravo', { endStr: 'november' }); await settle(p);
  const r = (await L.rects(p, '#p', 'delta'))[0];
  await p.mouse.move(r.left + 5, (r.top + r.bottom) / 2); await p.mouse.down();
  await p.mouse.move(r.left + 60, r.bottom + 120, { steps: 8 });
  await p.mouse.up(); await p.waitForTimeout(500);
  const s = await state(p);
  L.check('selection still there after the text drag', s.sel.startsWith('bravo'), s);
  L.check('its annotations are marked again', s.marks > 0 && s.masked > 0, s);
  await L.done(b);
})();
