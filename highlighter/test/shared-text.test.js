// 7.53: annotations of different styles share text (highlight + line, two highlights as bands).
const L = require('./lib');
const html = `<html><body style="font:18px/1.5 Georgia,serif;margin:40px;width:700px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima.</p>
<p id="q">Second paragraph mike november oscar papa quebec romeo sierra.</p></body></html>`;
const sw = page => page.evaluate(() => window.__hl.allWrappers().map(w => {
  const svg = window.__hl.getSvg(w); const p = svg && svg.querySelector('path');
  return { k: w.getAttribute('data-style-key'), t: w.textContent, sw: p ? +(+p.getAttribute('stroke-width')).toFixed(1) : null, nested: !!w.parentElement.closest('[data-highlighter-group]') };
}));
const recs = s => s.map(r => `${r.key}:${r.text}`).sort();
(async () => {
  const b = await L.launch();
  for (const scheme of ['light', 'dark']) {
    const { page } = await L.open(b, { html, scheme });
    await L.selStr(page, '#p', 'Alpha', { endStr: 'charlie' }); await L.altKey(page, 'KeyH');
    await L.selStr(page, '#p', 'bravo', { endStr: 'delta' }); await L.altKey(page, 'KeyU');
    let w = await L.wr(page);
    L.check(`${scheme} highlight kept under underline`, w.some(x => x.k === 'h' && x.t === 'Alpha bravo charlie') && w.filter(x => x.k === 'u').map(x => x.t).join('') === 'bravo charlie delta', w);
    // second highlight, partly over the first
    await L.selStr(page, '#p', 'charlie', { endStr: 'echo' }); await L.altKey(page, 'Digit2');
    await page.waitForTimeout(300);
    let s = await sw(page);
    const y = s.find(x => x.k === 'h'), gIn = s.find(x => x.k === 'h2' && x.nested), gOut = s.find(x => x.k === 'h2' && !x.nested);
    L.check(`${scheme} yellow whole`, y && y.t === 'Alpha bravo charlie', s);
    L.check(`${scheme} green nested part is a half band`, gIn && gOut && Math.abs(gIn.sw * 2 - gOut.sw) < 1.5 && Math.abs(y.sw - gOut.sw) < 1.5, s);
    let st = await L.stored(page);
    L.check(`${scheme} stored 3 annotations`, new Set(st.map(r => r.group)).size === 3, recs(st));
    // toolbar shows both pressed over "charlie"
    await L.selStr(page, '#p', 'charlie'); await page.waitForTimeout(500);
    const tb = await L.toolbar(page);
    const pressed = tb ? tb.buttons.filter(x => x.pressed === 'true').map(x => x.label) : null;
    L.check(`${scheme} toolbar shows three pressed`, pressed && pressed.length === 3, pressed);
    // Yellow again removes only the yellow
    await L.altKey(page, 'KeyH');
    w = await L.wr(page);
    L.check(`${scheme} H removes only yellow`, !w.some(x => x.k === 'h') && w.some(x => x.k === 'h2') && w.some(x => x.k === 'u'), w);
    await page.waitForTimeout(100);
    s = await sw(page);
    const greens = s.filter(x => x.k === 'h2');
    L.check(`${scheme} green full again`, greens.every(x => Math.abs(x.sw - greens[0].sw) < 0.6) && greens[0].sw > 15, s);
    await L.altKey(page, 'KeyZ');
    st = await L.stored(page);
    L.check(`${scheme} undo brings yellow back`, st.some(r => r.key === 'h'), recs(st));
    // reload: same annotations come back, nested
    const before = recs(st);
    const { page: p2 } = await L.open(b, { html, scheme, store: await page.evaluate(() => window.__gm) });
    await p2.waitForTimeout(300);
    const after = recs(await L.stored(p2));
    const s2 = await sw(p2);
    L.check(`${scheme} reload restores all`, JSON.stringify(before) === JSON.stringify(after) && s2.length === s.length + 1 && p2.__errors.length === 0, { before, after, s2, e: p2.__errors });
    L.check(`${scheme} reload keeps the band`, s2.some(x => x.k === 'h2' && x.nested && x.sw < 15), s2);
    // restyle yellow to green by clicking it: the nested green merges in
    const pt = await p2.evaluate(() => { const w = window.__hl.allWrappers().find(w => w.getAttribute('data-style-key') === 'h'); const r = w.getClientRects()[0]; return { x: r.left + 4, y: r.top + r.height / 2 }; });
    await p2.mouse.click(pt.x, pt.y); await p2.waitForTimeout(150);
    await p2.keyboard.press('Digit2'); await p2.waitForTimeout(300);
    const s3 = await sw(p2);
    L.check(`${scheme} restyle drops nested same style`, !s3.some(x => x.k === 'h2' && x.nested && x.sw < 15) && !s3.some(x => x.k === 'h'), s3);
    await p2.keyboard.press('Escape');
    // eraser takes everything off the selection
    await L.selStr(p2, '#p', 'charlie'); await L.altKey(p2, 'Backspace');
    const w4 = await L.wr(p2);
    L.check(`${scheme} eraser clears all styles there`, !w4.some(x => x.t.includes('charlie')), w4);
    // same style still merges
    await L.selStr(p2, '#q', 'mike', { endStr: 'oscar' }); await L.altKey(p2, 'KeyH');
    await L.selStr(p2, '#q', 'oscar', { endStr: 'quebec' }); await L.altKey(p2, 'KeyH');
    const w5 = (await L.wr(p2)).filter(x => x.k === 'h' && x.t.includes('mike'));
    L.check(`${scheme} same style merges`, w5.length === 1 && w5[0].t === 'mike november oscar papa quebec', w5);
    L.check(`${scheme} no errors`, page.__errors.length === 0 && p2.__errors.length === 0, [page.__errors, p2.__errors]);
  }
  await b.close();
  process.exit(L.fails ? 1 : 0);
})();
