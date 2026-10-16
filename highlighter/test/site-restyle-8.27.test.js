// 8.27: annotations follow their text when the site restyles the page without resizing the
// window (its own font size or padding setting, a class on <html>, a stylesheet added).
const L = require('./lib');
const TEXT = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar';
const rec = (word, key) => { const at = TEXT.indexOf(word); return { xpath: '//*[@id="p"]', startOffset: at, length: word.length, key, text: word, prefix: TEXT.slice(Math.max(0, at - 24), at), suffix: TEXT.slice(at + word.length, at + word.length + 24), group: 'g' + key }; };
// Where each drawing's first stroke sits on its text's first line: its left edge and width
// against the text's, and its middle as a share of the line's height.
const gaps = () => window.__hl.allWrappers().map(w => {
  const a = w.getClientRects()[0], s = window.__hl.getSvg(w).querySelector('path').getBoundingClientRect();
  return { left: s.left - a.left, width: s.width / a.width, mid: ((s.top + s.bottom) / 2 - a.top) / a.height };
});
const SAME = `(a, b) => a.length === b.length && a.every((g, i) => Math.abs(g.left - b[i].left) <= 2 && Math.abs(g.width - b[i].width) <= 0.05 && Math.abs(g.mid - b[i].mid) <= 0.06)`;
const same = eval(SAME);

(async () => {
  const b = await L.launch();
  const store = { 'https://example.test/a': JSON.stringify([rec('bravo', 'h'), rec('kilo', 'u'), rec('mike', 's')]) };
  // The page fills the window and scrolls inside, so it never grows.
  const html = `<!doctype html><html style="height:100%"><head><style>html.big #p { font-size: 26px }</style></head>
    <body style="height:100%;margin:0;overflow:hidden"><div id="box" style="height:100%;overflow:auto;font:18px/1.6 serif">
    <p id="p" style="width:420px;margin:40px">${TEXT}</p></div></body></html>`;
  const { page: p } = await L.open(b, { html, store });
  await p.waitForFunction(() => window.__hl.allWrappers().length === 3);
  await p.waitForTimeout(400);
  const base = await p.evaluate(gaps);
  const follows = async (name, change) => {
    await p.evaluate(change);
    const ok = await L.until(p, ([g, same, b]) => eval(same)(eval(g)(), b), [`(${gaps})`, SAME, base], 2000);
    L.check(name, ok, { base, now: await p.evaluate(gaps) });
  };
  await follows('padding set on the paragraph', () => { document.getElementById('p').style.paddingLeft = '60px'; });
  await follows('font size set on the scrolling box', () => { document.getElementById('box').style.fontSize = '22px'; });
  await follows('a class on <html> that a stylesheet sizes', () => { document.documentElement.classList.add('big'); });
  await follows('a stylesheet added', () => { const s = document.createElement('style'); s.textContent = '#p { letter-spacing: 3px; padding-top: 30px }'; document.head.appendChild(s); });
  await follows('a stylesheet edited', () => { document.head.lastElementChild.textContent = '#p { letter-spacing: 0; padding-top: 0 }'; });
  // Redrawing changes only our own drawings, which the watcher leaves out: nothing keeps redrawing.
  const redraws = await p.evaluate(() => new Promise(r => {
    let n = 0; const mo = new MutationObserver(l => { n += l.filter(m => m.target.closest && m.target.closest('svg')).length; });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true });
    setTimeout(() => { mo.disconnect(); r(n); }, 1500);
  }));
  L.check('nothing keeps redrawing once the page is still', redraws === 0, redraws);
  L.check('drawings still in place', same(await p.evaluate(gaps), base), await p.evaluate(gaps));
  await L.done(b);
})();
