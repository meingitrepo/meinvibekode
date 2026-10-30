// 7.55: the outline of a clicked annotation follows its lines. 7.57: an annotation in several
// pieces draws in as one stroke in 200 ms. 7.59: a highlight's colour comes back in the same
// moment the selection over it goes (on the mouse press).
// (7.56 is in restyle-merge.test.js, 7.58 in selection-gap.test.js.)
const L = require('./lib');
const words = Array.from({ length: 60 }, (_, i) => 'word' + i).join(' ');
const html = `<!doctype html><html><body style="font:18px/1.6 Georgia,serif;margin:40px;width:500px">
<p id="p">${words}.</p>
<p id="q">Start of <b>a bold sentence</b> with words <a href="#x">and a link</a> in the middle.</p></body></html>`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  // 7.55: from the middle of one line to the middle of another: a stepped outline, not a box (4 corners)
  await L.selStr(page, '#p', 'word10 ', { endStr: 'word30' }); await L.altKey(page, 'h');
  await page.evaluate(() => getSelection().removeAllRanges());
  const lines = await page.evaluate(() => { const w = document.querySelector('[data-highlighter-wrapper]'); return Array.from(w.getClientRects()).map(r => [r.left, r.right]); });
  L.check('setup: the annotation spans lines, starting and ending mid-line', lines.length >= 2 && lines[0][0] > lines[1][0] + 20 && lines[lines.length - 1][1] < lines[0][1] - 20, lines);
  const at = await page.evaluate(() => { const r = document.querySelector('[data-highlighter-wrapper]').getClientRects()[0]; return { x: r.left + 10, y: r.top + r.height / 2 }; });
  await page.mouse.click(at.x, at.y); await page.waitForTimeout(300);
  const d = await page.evaluate(() => { const p = window.__hl.selectBoxesEl.querySelector('path'); return p && p.getAttribute('d'); });
  const corners = d ? (d.match(/Q/g) || []).length : 0;
  L.check('the outline follows the text: one shape with steps', corners >= 8 && (d.match(/M/g) || []).length === 1, { corners, d });
  await page.keyboard.press('Escape');
  // 7.57: the pieces of an annotation from bold text into a link draw in one after another, 200 ms in all
  await L.selStr(page, '#q', 'bold', { endStr: 'and a' }); await L.altKey(page, 'h');
  const anim = await page.evaluate(() => Array.from(document.querySelectorAll('#q [data-highlighter-wrapper]')).flatMap(w => {
    const svg = window.__hl.getSvg(w);
    return Array.from(svg.querySelectorAll('path')).map(p => { const m = /(\d+(?:\.\d+)?)ms \S+ (\d+(?:\.\d+)?)ms/.exec(p.style.animation); return m ? [+m[1], +m[2]] : null; });
  }));
  L.check('setup: three pieces, each drawing in', anim.length === 3 && anim.every(Boolean), anim);
  if (anim.length === 3 && anim.every(Boolean)) {
    const total = anim.reduce((s, a) => s + a[0], 0);
    L.check('together they take 200 ms', Math.abs(total - 200) < 1, anim);
    L.check('each starts when the one before ends', anim.every((a, i) => i === 0 ? a[1] === 0 : Math.abs(a[1] - (anim[i - 1][1] + anim[i - 1][0])) < 1), anim);
  }
  // 7.59: selected highlight parts are unmarked on the press itself, not a frame later
  await L.selStr(page, '#p', 'word12', { endStr: 'word20' }); await page.waitForTimeout(200);
  const marked = await page.evaluate(() => document.querySelectorAll('svg[data-highlighter-selected-part]').length);
  L.check('setup: the selected part is outlined', marked > 0, marked);
  const left = await page.evaluate(() => {
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 5, clientY: 5 }));
    return document.querySelectorAll('svg[data-highlighter-selected-part], g[data-highlighter-selected-part], path[mask]').length;
  });
  L.check('the press unmarks it at once', left === 0, left);
  L.check('no page errors', page.__errors.length === 0, page.__errors);
  await L.done(b);
})();
