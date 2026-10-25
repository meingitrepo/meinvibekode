// 7.32 item 2: Alt+P pen.
const L = require('./lib');
const P = i => `Paragraph number ${i} has several plain words that a reader might mark.`;
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px;max-width:700px">
<p id="p1">${P(1)}</p><p id="p2">${P(2)}</p><p id="p3">${P(3)}</p><p id="p4">${P(4)}</p><p id="p5">${P(5)}</p>
<input id="f" value="a field with words"></body></html>`;
const results = [];
const check = (name, ok, info) => results.push([name, ok, info]);
// The pen's state is its blue (pressed) tool button; the pen bar has no label.
const pill = p => p.evaluate(() => { const e = window.__hl.penEl; if (e.hidden) return null; const b = e.querySelector('button[aria-pressed="true"]'); return b ? 'Pen: ' + b.dataset.label.toLowerCase() : ''; });
const selText = p => p.evaluate(() => getSelection().toString());

async function basics(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  await L.altKey(p, 'p');
  check('Alt+P turns the pen on with yellow and shows the pill', (await pill(p)) === 'Pen: yellow highlight', await pill(p));
  await L.drag(p, '#p1', 'several plain words');
  let w = await L.wr(p);
  check('a mouse selection is highlighted at once', w.length === 1 && w[0].k === 'h' && w[0].t === 'several plain words', w);
  check('and the selection is gone, with no toolbar', (await selText(p)) === '' && (await L.toolbar(p)) === null, { s: await selText(p), t: await L.toolbar(p) });
  await L.drag(p, '#p1', 'several plain words');
  w = await L.wr(p);
  check('selecting the same text again keeps it (the pen only adds)', w.length === 1 && w[0].k === 'h', w);
  // double-click a word
  const r = (await L.rects(p, '#p2', 'reader'))[0];
  await p.mouse.dblclick((r.left + r.right) / 2, (r.top + r.bottom) / 2); await p.waitForTimeout(350);
  w = await L.wr(p);
  check('a double-clicked word is highlighted', w.some(x => x.t === 'reader' && x.k === 'h'), w);
  // the pen bar's eraser tool: dragging over annotated text erases it
  await p.evaluate(() => [...window.__hl.penEl.querySelectorAll('button')].find(b => b.dataset.label === 'Eraser').click());
  check('the eraser button makes the pen erase', (await pill(p)) === 'Pen: eraser', await pill(p));
  await L.drag(p, '#p1', 'several plain words');
  w = await L.wr(p);
  check('with the eraser, selecting annotated text erases it', !w.some(x => x.t.includes('several plain words')), w);
  await p.evaluate(() => [...window.__hl.penEl.querySelectorAll('button')][2].click());
  await p.mouse.move(5, 5);
  await L.altKey(p, 'u');
  check('a style key with nothing selected or pointed at changes the pen', (await pill(p)) === 'Pen: underline', await pill(p));
  await L.altKey(p, 'd');
  check('Alt+D with nothing selected or pointed at makes the pen erase', (await pill(p)) === 'Pen: eraser', await pill(p));
  check('the eraser button shows Alt+D', await p.evaluate(() => [...window.__hl.penEl.querySelectorAll('button')].find(b => b.dataset.label === 'Eraser').dataset.shortcut) === 'Alt+D', null);
  await L.altKey(p, 'u');
  await L.drag(p, '#p3', 'plain words');
  w = await L.wr(p);
  check('the next selection gets that style', w.some(x => x.t === 'plain words' && x.k === 'u'), w);
  await L.altKey(p, 'z');
  check('Alt+Z undoes a pen stroke', !(await L.wr(p)).some(x => x.k === 'u'), await L.wr(p));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  check('Esc turns the pen off', (await pill(p)) === null && (await p.evaluate(() => window.__hl.penKey)) === null, await pill(p));
  const before = (await L.wr(p)).length;
  await L.drag(p, '#p4', 'plain words');
  await p.waitForTimeout(300);
  check('with the pen off a selection stays a selection, with the toolbar', (await L.wr(p)).length === before && (await selText(p)) === 'plain words' && (await L.toolbar(p)) !== null, { s: await selText(p) });
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

async function startsWithLast(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  await L.selStr(p, '#p1', 'plain words');
  await L.altKey(p, '1');
  await L.altKey(p, 'p');
  check('the pen starts with the style used last', (await pill(p)) === 'Pen: cyan highlight', await pill(p));
  await L.altKey(p, 'p');
  check('Alt+P again turns it off', (await pill(p)) === null, await pill(p));
  await ctx.close();
}

async function keyboardAndFields(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  await L.altKey(p, 'p');
  await L.selStr(p, '#p2', 'plain words'); await p.waitForTimeout(400);
  check('a keyboard (non-mouse) selection is not drawn on: no toolbar either (the pen bar is the toolbar)', (await L.wr(p)).length === 0 && (await L.toolbar(p)) === null, await L.wr(p));
  await p.evaluate(() => getSelection().removeAllRanges());
  const f = await p.$('#f'); const b = await f.boundingBox();
  await p.mouse.move(b.x + 3, b.y + b.height / 2); await p.mouse.down(); await p.mouse.move(b.x + b.width - 3, b.y + b.height / 2, { steps: 4 }); await p.mouse.up(); await p.waitForTimeout(300);
  check('selecting in a form field draws nothing', (await L.wr(p)).length === 0, await L.wr(p));
  await p.focus('#f'); await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  check('Esc in a field leaves the pen on', (await pill(p)) !== null, await pill(p));
  await p.evaluate(() => document.activeElement.blur());
  // Esc while a note is being written closes the note, not the pen
  await L.selStr(p, '#p3', 'plain words');
  await L.altKey(p, 'n');
  const ed = await p.evaluate(() => !!window.__hl.editor);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  check('Esc in the note editor closes the editor and keeps the pen', ed && !(await p.evaluate(() => !!window.__hl.editor)) && (await pill(p)) !== null, { ed, pill: await pill(p) });
  // the pill's button
  await p.evaluate(() => [...window.__hl.penEl.querySelectorAll('button')].pop().click()); await p.waitForTimeout(100);
  check('the pill\'s button turns it off', (await pill(p)) === null, await pill(p));
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

async function restyleStillWorks(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  await L.altKey(p, 'p');
  await L.drag(p, '#p1', 'plain words');
  const r = (await L.rects(p, '#p1', 'plain words'))[0];
  await p.mouse.move((r.left + r.right) / 2, (r.top + r.bottom) / 2); await p.waitForTimeout(100);
  await L.altKey(p, 's');
  const w = await L.wr(p);
  check('pointing at an annotation, a style key restyles it rather than the pen', w.length === 1 && w[0].k === 's' && (await pill(p)) === 'Pen: yellow highlight', { w, pill: await pill(p) });
  await ctx.close();
}

async function dark(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML.replace('<body style="', '<body style="background:#111;color:#eee;'), scheme: 'dark' });
  await L.altKey(p, 'p');
  check('the pill follows a dark page', (await p.evaluate(() => window.__hl.penEl.getAttribute('data-theme'))) === 'dark', null);
  await ctx.close();
}

async function staleSelectionFromPanel(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  await L.selStr(p, '#p1', 'plain words');
  await L.altKey(p, '1');
  await L.altKey(p, 'o');
  await p.evaluate(() => window.__hl.panelEl.querySelector('[data-act="jump"]').click());
  await p.waitForTimeout(300);
  await p.mouse.click(5, 5); await p.waitForTimeout(100);
  await L.altKey(p, 'p');
  await p.mouse.move(5, 5);
  await L.altKey(p, 'u');
  const w = await L.wr(p);
  check('with the panel open and nothing selected, a style key changes the pen, not an annotation', w.length === 1 && w[0].k === 'h2' && (await pill(p)) === 'Pen: underline', { w, pill: await pill(p), sel: await p.evaluate(() => window.__hl.selectedGroups.length) });
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([basics, startsWithLast, keyboardAndFields, restyleStillWorks, staleSelectionFromPanel, dark].map(f => f(browser).catch(e => check(`${f.name} crashed`, false, e.stack))));
  await browser.close();
  let fails = 0;
  results.forEach(([name, ok, info]) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + JSON.stringify(info)}`); if (!ok) fails++; });
  console.log(`FAILS ${fails}`);
  process.exit(fails);
})();
