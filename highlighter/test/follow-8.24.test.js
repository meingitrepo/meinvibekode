// 8.24: a selection dragged over annotations marks again only those whose selected part changed,
// and when the page grows or shifts only the annotations near the screen are looked at in that frame.
const L = require('./lib');
const SEL = '[data-highlighter-selected-part]';
const W = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango'.split(' ');
const TEXT = W.join(' ');
const CTX = 24;
const rec = (xpath, text, word, key, g) => {
  const at = text.indexOf(word);
  return { xpath, startOffset: at, length: word.length, key, text: word, prefix: text.slice(Math.max(0, at - CTX), at), suffix: text.slice(at + word.length, at + word.length + CTX), group: `g${g}` };
};
const frames = p => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
const wrapperOf = word => `Array.from(document.querySelectorAll('[data-highlighter-wrapper]')).find(w => w.textContent === ${JSON.stringify(word)})`;
// Tags every selection mark node, then later counts which tags are still on the page.
const tagMarks = p => p.evaluate(s => { window.__tagged = Array.from(document.querySelectorAll(s)); window.__tagged.forEach(el => { el.__tag = true; }); return window.__tagged.length; }, SEL);
const markOf = (p, word) => p.evaluate(`(() => { const w = ${wrapperOf(word)}; const svg = window.__hl.getSvg(w); const mine = Array.from(svg.querySelectorAll('${SEL}')); const next = w.nextElementSibling; if (next && next.matches('svg${SEL}')) mine.push(next); return { marks: mine.length, kept: mine.filter(el => el.__tag).length, masked: svg.querySelectorAll('path[mask]').length }; })()`);

(async () => {
  const b = await L.launch();
  {
    const store = { 'https://example.test/a': JSON.stringify([
      rec('//*[@id="p"]', TEXT, 'bravo', 'h', 1), rec('//*[@id="p"]', TEXT, 'golf', 'u', 2),
      rec('//*[@id="p"]', TEXT, 'kilo', 's', 3), rec('//*[@id="p"]', TEXT, 'oscar papa quebec', 'h', 4)]) };
    const html = `<!doctype html><html><body style="font:18px/1.6 serif;margin:40px;width:420px"><p id="p">${TEXT}</p></body></html>`;
    const { page: p } = await L.open(b, { html, store });
    await p.waitForFunction(() => window.__hl.allWrappers().length === 4);
    await p.waitForTimeout(400);
    await L.selStr(p, '#p', 'alpha', { endStr: 'romeo' }); await frames(p);
    const all = await tagMarks(p);
    L.check('the four selected annotations are marked', all >= 4 && (await Promise.all(['bravo', 'golf', 'kilo', 'oscar papa quebec'].map(w => markOf(p, w)))).every(m => m.marks > 0), all);
    await L.selStr(p, '#p', 'alpha', { endStr: 'sierra' }); await frames(p);
    const kept = await p.evaluate(() => window.__tagged.filter(el => el.isConnected).length);
    L.check('growing the selection over plain text keeps every mark as it was', kept === all, { kept, all });
    await L.selStr(p, '#p', 'alpha', { endStr: 'oscar pa' }); await frames(p);
    const part = await markOf(p, 'oscar papa quebec');
    const others = await Promise.all(['bravo', 'golf', 'kilo'].map(w => markOf(p, w)));
    L.check('ending inside an annotation marks that one again', part.marks > 0 && part.kept === 0, part);
    L.check('and leaves the others as they were', others.every(m => m.marks > 0 && m.kept === m.marks), others);
    await L.selStr(p, '#p', 'hotel', { endStr: 'romeo' }); await frames(p);
    const left = await Promise.all(['bravo', 'golf'].map(w => markOf(p, w)));
    L.check('annotations the selection left are unmarked', left.every(m => m.marks === 0 && m.masked === 0), left);
    L.check('one it still holds stays marked', (await markOf(p, 'kilo')).marks > 0, null);
    await p.setViewportSize({ width: 1000, height: 650 }); await p.waitForTimeout(250); await frames(p);
    L.check('after a redraw the selected parts are marked again', (await markOf(p, 'kilo')).marks > 0 && (await markOf(p, 'oscar papa quebec')).marks > 0, null);
    await L.selStr(p, '#p', 'bravo'); await frames(p);
    await L.altKey(p, 'KeyD'); await frames(p);
    L.check('erasing a selected highlight leaves no outline behind', await p.evaluate(s => document.querySelectorAll(`svg${s}`).length, SEL) === 0, null);
    await L.selStr(p, '#p', 'alpha', { endStr: 'tango' }); await frames(p);
    await p.evaluate(() => getSelection().removeAllRanges()); await frames(p);
    L.check('a cleared selection leaves no marks', await p.evaluate(s => document.querySelectorAll(s).length + document.querySelectorAll('path[mask]').length, SEL) === 0, null);
    L.check('no page errors', !p.__errors.length, p.__errors);
    await p.context().close();
  }
  {
    // 60 paragraphs, one annotation in each.
    const paras = Array.from({ length: 60 }, (_, i) => `<p id="q${i}">${i} ${TEXT}</p>`).join('');
    const recs = Array.from({ length: 60 }, (_, i) => rec(`//*[@id="q${i}"]`, `${i} ${TEXT}`, 'hotel', i % 2 ? 'u' : 'h', 100 + i));
    const html = `<!doctype html><html><body style="font:16px/1.5 sans-serif;margin:40px;width:600px"><div id="top"></div>${paras}</body></html>`;
    const { page: p } = await L.open(b, { html, store: { 'https://example.test/a': JSON.stringify(recs) } });
    await p.waitForFunction(() => window.__hl.allWrappers().length === 60);
    await p.waitForTimeout(400);
    const offsets = () => p.evaluate(() => window.__hl.allWrappers().map(w => {
      const a = w.getBoundingClientRect();
      if (a.bottom < 0 || a.top > innerHeight) return null;
      let t = null; window.__hl.getSvg(w).querySelectorAll('path').forEach(q => { const r = q.getBoundingClientRect(); if (r.width || r.height) t = t === null ? r.top : Math.min(t, r.top); });
      return t === null ? null : Math.round(t - a.top);
    }));
    await p.evaluate(() => scrollTo(0, 900)); await p.waitForTimeout(300);
    const before = await offsets();
    const moved = () => offsets().then(now => now.filter((o, i) => o !== null && before[i] !== null && Math.abs(o - before[i]) > 1).length);
    await p.evaluate(() => { document.getElementById('top').style.height = '37px'; }); await frames(p);
    L.check('content above grows: those on screen follow in the next frame', await moved() === 0, await offsets());
    // The site takes a paragraph off the page and puts it back later, somewhere else.
    await p.evaluate(() => { window.__q = document.getElementById('q20'); window.__q.remove(); });
    await p.evaluate(() => { document.getElementById('top').style.height = '80px'; }); await p.waitForTimeout(1300);
    await p.evaluate(() => document.getElementById('q24').after(window.__q)); await p.waitForTimeout(300);
    await p.evaluate(() => { document.getElementById('top').style.height = '120px'; }); await frames(p); await p.waitForTimeout(1300);
    // q20 and q22 are both highlights: the drawing sits the same way on each one's text.
    const [back, ref] = await p.evaluate(() => [window.__q, document.getElementById('q22')].map(el => {
      const w = el.querySelector('[data-highlighter-wrapper]'); if (!w) return 'no wrapper';
      const a = w.getBoundingClientRect(); let t = null;
      window.__hl.getSvg(w).querySelectorAll('path').forEach(q => { const r = q.getBoundingClientRect(); if (r.width || r.height) t = t === null ? r.top : Math.min(t, r.top); });
      return t === null ? 'not drawn' : Math.round(t - a.top);
    }));
    L.check('one the site put back follows its text too', typeof back === 'number' && Math.abs(back - ref) <= 1, { back, ref });
    L.check('no page errors', !p.__errors.length, p.__errors);
    await p.context().close();
  }
  {
    // The page's only annotation is taken off the page for a while: once it is back, it still
    // follows its text.
    const html = `<!doctype html><html><body style="font:16px/1.5 sans-serif;margin:40px;width:600px"><div id="top"></div><div id="box"><p id="r">${TEXT}</p></div></body></html>`;
    const { page: p } = await L.open(b, { html, store: { 'https://example.test/a': JSON.stringify([rec('//*[@id="r"]', TEXT, 'hotel', 'h', 200)]) } });
    await p.waitForFunction(() => window.__hl.allWrappers().length === 1);
    await p.waitForTimeout(400);
    const offset = () => p.evaluate(() => {
      const w = document.querySelector('#r [data-highlighter-wrapper]'); if (!w) return 'no wrapper';
      const a = w.getBoundingClientRect(); let t = null;
      window.__hl.getSvg(w).querySelectorAll('path').forEach(q => { const r = q.getBoundingClientRect(); if (r.width || r.height) t = t === null ? r.top : Math.min(t, r.top); });
      return t === null ? 'not drawn' : Math.round(t - a.top);
    });
    const ref = await offset();
    await p.evaluate(() => { window.__r = document.getElementById('r'); window.__r.remove(); document.getElementById('top').style.height = '30px'; });
    await p.waitForTimeout(1300);
    await p.evaluate(() => document.getElementById('box').append(window.__r)); await p.waitForTimeout(300);
    await p.evaluate(() => { document.getElementById('top').style.height = '90px'; }); await frames(p);
    const back = await offset();
    L.check('the only annotation, put back after a while, follows its text', back === ref, { back, ref });
    L.check('no page errors', !p.__errors.length, p.__errors);
    await p.context().close();
  }
  await L.done(b);
})();
