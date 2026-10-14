// 7.56: restyling an overlapping highlight to its neighbour's color merges the two (was: the shared part was cut off).
const L = require('./lib');
const html = `<html><body style="font:18px/1.5 Georgia,serif;margin:40px;width:700px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima.</p></body></html>`;
const groups = w => { const m = {}; w.forEach(x => { (m[x.g] = m[x.g] || []).push(x.t); }); return Object.values(m).map(a => a.join('')); };
(async () => {
  const b = await L.launch();
  for (const which of ['inner', 'outer']) {
    const { page } = await L.open(b, { html });
    await L.selStr(page, '#p', 'Alpha', { endStr: 'charlie' }); await L.altKey(page, 'KeyH');
    await L.selStr(page, '#p', 'bravo', { endStr: 'echo' }); await L.altKey(page, 'Digit4');
    await page.evaluate(() => { const g = window.__hl.allWrappers().find(w => w.getAttribute('data-style-key') === 'h'); g.setAttribute('data-highlighter-note', 'yellow note'); });
    // click the magenta (outside the yellow) or the yellow, and give it the other's color
    const key = which === 'inner' ? 'h4' : 'h';
    const pt = await page.evaluate(k => { const ws = window.__hl.allWrappers().filter(w => w.getAttribute('data-style-key') === k); const w = ws[ws.length - 1]; const r = w.getClientRects()[0]; return k === 'h' ? { x: r.left + 4, y: r.top + r.height / 2 } : { x: r.right - 4, y: r.top + r.height / 2 }; }, key);
    await page.mouse.click(pt.x, pt.y); await page.waitForTimeout(150);
    await page.keyboard.press(which === 'inner' ? 'Digit1' : 'Digit4');
    // 7.57: the merged annotation draws in as one stroke: its pieces one after another, 200 ms in all
    const anim = await page.evaluate(() => window.__hl.allWrappers().map(w => { const p = window.__hl.getSvg(w).querySelector('path'); const m = /(\d+(?:\.\d+)?)ms ease-out (\d+(?:\.\d+)?)ms/.exec(p.style.animation || ''); return m ? [w.textContent, +m[1], +m[2]] : [w.textContent, null]; }));
    const spans = anim.filter(a => a[1] !== null).map(a => [a[2], a[2] + a[1]]).sort((x, y) => x[0] - y[0]);
    L.check(`${which}: pieces animate in turn, 200 ms in all`, anim.every(a => a[1] !== null) && Math.abs(spans[spans.length - 1][1] - 200) < 1 && spans.every((s, i) => !i || Math.abs(s[0] - spans[i - 1][1]) < 1), anim);
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    const w = await L.wr(page);
    const k2 = which === 'inner' ? 'h' : 'h4';
    L.check(`${which}: one annotation in the new color covers both`, w.every(x => x.k === k2) && JSON.stringify(groups(w)) === JSON.stringify(['Alpha bravo charlie delta echo']), w);
    L.check(`${which}: note kept`, w.every(x => x.n === 'yellow note'), w);
    const st = await L.stored(page);
    L.check(`${which}: stored as one`, new Set(st.map(r => r.group)).size === 1 && st.map(r => r.text).join('') === 'Alpha bravo charlie delta echo', st);
    await L.altKey(page, 'KeyZ');
    const u = await L.wr(page);
    L.check(`${which}: undo brings both back`, u.some(x => x.k === 'h') && u.some(x => x.k === 'h4'), u);
    L.check(`${which}: no errors`, page.__errors.length === 0, page.__errors);
  }
  await b.close();
  process.exit(L.fails ? 1 : 0);
})();
