// 8.25 (from review): a tab panel's nodes put back by the site while out of view are followed again.
// A tab panel (same nodes) is taken off the page while the reader is at the top, and put back
// a moment later: its annotation is below the fold. Then content above it grows (an image in
// the panel loads). Where is the annotation drawn, 1.5 s later?
const L = require('./lib');
const TEXT = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa';
const CTX = 24;
const rec = (xpath, text, word, key, g) => { const at = text.indexOf(word);
  return { xpath, startOffset: at, length: word.length, key, text: word, prefix: text.slice(Math.max(0, at - CTX), at), suffix: text.slice(at + word.length, at + word.length + CTX), group: `g${g}` }; };
const filler = n => Array.from({ length: n }, (_, i) => `<p>filler ${i} lorem ipsum dolor sit amet consectetur</p>`).join('');

(async () => {
  const b = await L.launch();
  const html = `<!doctype html><html><body style="font:16px/1.5 sans-serif;margin:40px;width:600px">
    <div id="tabbar"><button id="t1">Tab 1</button><button id="t2">Tab 2</button></div>
    <div id="slot"><div id="P1"><div id="img" style="height:0"></div>${filler(60)}<p id="target">${TEXT}</p>${filler(40)}</div></div>
    <script>
      // Tabs that keep the panel's nodes and put them back (keep-alive).
      const P1 = document.getElementById('P1'); const P2 = document.createElement('div'); P2.innerHTML = '${filler(100)}';
      document.getElementById('t2').onclick = () => document.getElementById('slot').replaceChildren(P2);
      document.getElementById('t1').onclick = () => document.getElementById('slot').replaceChildren(P1);
    </script></body></html>`;
  const { page: p } = await L.open(b, { html, store: { 'https://example.test/a': JSON.stringify([rec('//*[@id="target"]', TEXT, 'hotel india', 'h', 1)]) } });
  await p.waitForFunction(() => window.__hl.allWrappers().length === 1);
  await p.waitForTimeout(400);
  const where = () => p.evaluate(() => {
    const w = document.querySelector('#target [data-highlighter-wrapper]');
    const svg = window.__hl.getSvg(w);
    const a = w.getBoundingClientRect();
    let t = null; svg.querySelectorAll('path').forEach(q => { const r = q.getBoundingClientRect(); if (r.width || r.height) t = t === null ? r.top : Math.min(t, r.top); });
    return { textTop: Math.round(a.top + scrollY), drawnTop: t === null ? null : Math.round(t + scrollY), shown: window.__hl.shownWrappers ? window.__hl.shownWrappers.size : 'n/a' };
  });
  const r0 = await where();
  await p.click('#t2'); await p.waitForTimeout(1500);   // reads tab 2 for a moment
  await p.click('#t1'); await p.waitForTimeout(500);    // back to tab 1, still at the top
  // An image near the top of the panel loads: everything below moves down 1200px.
  await p.evaluate(() => { document.getElementById('img').style.height = '1200px'; });
  await p.waitForTimeout(1500);
  const r = await where();
  // The reader scrolls down to where the annotation used to be: what is drawn there?
  await p.evaluate(y => scrollTo(0, y - 300), r.drawnTop); await p.waitForTimeout(300);
  const s = await where();
  const under = await p.evaluate(y => { const el = document.elementFromPoint(300, y - scrollY + 8); return el && el.textContent.slice(0, 40); }, s.drawnTop);
  L.check('the highlight is drawn on its text (as at the start)', s.drawnTop !== null && Math.abs((s.drawnTop - s.textTop) - (r0.drawnTop - r0.textTop)) <= 2, { s, r0 });
  // Scrolling on to the text itself: the observer sees it and draws it there.
  await p.evaluate(y => scrollTo(0, y - 300), s.textTop); await p.waitForTimeout(300);
  L.check('no page errors', !p.__errors.length, p.__errors);
  await L.done(b);
})();
