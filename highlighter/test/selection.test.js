// 7.29: pressed style, same style again removes the whole annotation, eraser removes exactly the
// selection, trimmed and word-snapped selections, triple-click on the visual paragraph.
const L = require('./lib');
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font: 16px/1.5 sans-serif; margin: 40px; max-width: 700px">
<p id="p1">The quick brown fox jumps over the lazy dog near the river bank.</p>
<p id="p2">Read <a href="#x">the settings page</a> for more details about it.</p>
<p id="p3">One two three four five six seven eight nine ten.</p>
<p id="p4">
      Indented paragraph text.
    </p>
<div id="d1">First line of the post<br>Second line, the one to select<br><br>Third line</div>
<p id="p5">今日は良い天気ですね。散歩に行きましょう。</p>
<p id="p6">Alpha beta gamma delta epsilon zeta eta theta.</p>
</body></html>`;
(async () => {
  const browser = await L.launch();
  const { ctx, page } = await L.open(browser, { html: HTML });
  // --- same style again: whole annotation, from a word inside ---
  await L.selStr(page, '#p1', 'quick brown fox jumps'); await L.altKey(page, 'h');
  await L.selStr(page, '#p1', 'brown');
  await page.mouse.move(5, 5); await page.evaluate(() => document.dispatchEvent(new Event('selectionchange')));
  await page.waitForTimeout(400);
  let tb = await L.toolbar(page);
  const yb = tb && tb.buttons.find(b => /yellow/i.test(b.label));
  L.check('toolbar shows yellow pressed', yb && yb.pressed === 'true' && yb.label === 'Erase yellow highlight' && tb.buttons.filter(b => b.pressed === 'true').length === 1, tb);
  L.check('pressed button has a background', yb && yb.bg !== 'rgba(0, 0, 0, 0)', yb);
  L.check('note button says Add note', tb && tb.buttons.some(b => b.label === 'Add note'), tb && tb.buttons.map(b => b.label));
  await L.altKey(page, 'h');
  let w = await L.wr(page);
  L.check('Alt+H on a word inside removes the whole highlight', w.length === 0, w);
  L.check('toast says removed', (await L.toast(page)) === 'Erased 1x annotation · Undo', await L.toast(page));
  await L.altKey(page, 'z');
  w = await L.wr(page);
  L.check('undo brings it back', w.length === 1 && w[0].t === 'quick brown fox jumps', w);
  // --- across a link: pieces of one annotation ---
  await L.selStr(page, '#p2', 'Read', { endStr: 'settings page' }); await L.altKey(page, 'u');
  w = await L.wr(page);
  L.check('annotation split across a link', w.filter(x => x.k === 'u').length === 2 && new Set(w.filter(x => x.k === 'u').map(x => x.g)).size === 1, w);
  await L.selStr(page, '#p2', 'settings'); await L.altKey(page, 'u');
  w = await L.wr(page);
  L.check('same style on one piece removes every piece', w.every(x => x.k !== 'u'), w);
  L.check('toast after removing a split one', (await L.toast(page)) === 'Erased 1x annotation · Undo', await L.toast(page));
  // a different style inside: goes on top, sharing the text (7.53)
  await L.selStr(page, '#p1', 'brown'); await L.altKey(page, '1');
  w = await L.wr(page);
  L.check('another style on a word inside goes on top of it', w.map(x => x.k + ':' + x.t).join('|') === 'h:quick brown fox jumps|h2:brown', w);
  // --- eraser: exactly the selection, rest keeps its note ---
  await L.selStr(page, '#p3', 'two three four five'); await L.altKey(page, '2');
  await L.selStr(page, '#p3', 'three'); await L.altKey(page, 'n'); await page.keyboard.type('Numbers note'); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  await L.selStr(page, '#p3', 'four');
  await page.waitForTimeout(400);
  tb = await L.toolbar(page);
  L.check('note button says Edit note on an annotation with a note', tb && tb.buttons.some(b => b.label === 'Edit note'), tb && tb.buttons.map(b => b.label));
  await L.altKey(page, 'Backspace');
  w = await L.wr(page).then(a => a.filter(x => x.k === 'h4'));
  L.check('eraser keeps the rest with its note, minus the spaces at the cut', w.map(x => x.t).join('|') === 'two three|five' && w.every(x => x.n === 'Numbers note') && new Set(w.map(x => x.g)).size === 1, w);
  L.check('eraser toast for a part', (await L.toast(page)) === 'Erased 1x annotation · Undo', await L.toast(page));
  let st = await L.stored(page);
  L.check('stored pieces keep note', st.filter(r => r.key === 'h4').length === 2 && st.filter(r => r.key === 'h4').every(r => r.note === 'Numbers note'), st.filter(r => r.key === 'h4'));
  await L.selStr(page, '#p3', 'two', { endStr: 'five' }); await L.altKey(page, 'Backspace');
  w = await L.wr(page).then(a => a.filter(x => x.k === 'h4'));
  L.check('eraser over all of it removes it', w.length === 0, w);
  L.check('eraser toast for whole', (await L.toast(page)) === 'Erased 1x annotation · Undo', await L.toast(page));
  // --- trimmed, snapped selections ---
  await L.selStr(page, '#p6', ' beta gamma '); await L.altKey(page, 'h');
  w = await L.wr(page).then(a => a.filter(x => x.t.includes('beta')));
  L.check('spaces at the edges trimmed', w.length === 1 && w[0].t === 'beta gamma', w);
  await L.selStr(page, '#p6', 'lta epsilon ze'); await L.altKey(page, 'u');
  w = await L.wr(page).then(a => a.filter(x => x.k === 'u'));
  L.check('half words snap to whole words', w.length === 1 && w[0].t === 'delta epsilon zeta', w);
  await L.selStr(page, '#p5', '日は良'); await L.altKey(page, 's');
  w = await L.wr(page).then(a => a.filter(x => x.k === 's'));
  L.check('CJK snaps by Intl.Segmenter words', w.length === 1 && w[0].t.includes('日は良') && w[0].t.length > 3 && w[0].t.length < 10, w);
  // --- triple-click ---
  const clickAt = async (sel, str) => {
    const p = await page.evaluate(([sel, str]) => { const el = document.querySelector(sel); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) { const i = n.nodeValue.indexOf(str); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 2); const b = r.getBoundingClientRect(); return { x: b.left + 2, y: b.top + b.height / 2 }; } } }, [sel, str]);
    await page.mouse.click(p.x, p.y, { clickCount: 3 });
    await page.waitForTimeout(100);
    return page.evaluate(() => getSelection().toString());
  };
  let s = await clickAt('#p4', 'Indented');
  L.check('triple-click leaves out the indentation', s === 'Indented paragraph text.', s);
  await L.altKey(page, 'h');
  st = await L.stored(page);
  L.check('stored without indentation', st.some(r => r.text === 'Indented paragraph text.'), st.map(r => r.text));
  s = await clickAt('#d1', 'Second');
  L.check('triple-click selects one line between <br>s', s === 'Second line, the one to select', s);
  s = await clickAt('#d1', 'Third');
  L.check('triple-click on the last line', s === 'Third line', s);
  L.check('no page errors', page.__errors.length === 0, page.__errors);
  await ctx.close();
  await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
