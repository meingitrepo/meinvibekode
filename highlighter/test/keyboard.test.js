// 7.33 item 10: the toolbar is one Tab stop with arrow keys; Tab stays inside the note editor.
const L = require('./lib');
const check = L.check;
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px">
<p id="p1">Plain words to mark in the first paragraph here.</p><button id="after">page button</button></body></html>`;
const focused = p => p.evaluate(() => { const r = window.__hl; const a = r.uiRoot.activeElement; if (!a) return document.activeElement && document.activeElement.id || null;
  const bs = Array.from(r.toolbarEl.querySelectorAll('button')); const i = bs.indexOf(a); if (i >= 0) return 'tb' + i;
  return a.tagName === 'TEXTAREA' ? 'input' : (a.getAttribute('aria-label') || a.tagName); });

async function toolbar(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  await L.selStr(p, '#p1', 'Plain words'); await p.waitForTimeout(400);
  const tabs = await p.evaluate(() => Array.from(window.__hl.toolbarEl.querySelectorAll('button')).map(b => b.tabIndex));
  check('one Tab stop: the first button', tabs[0] === 0 && tabs.slice(1).every(t => t === -1) && tabs.length > 3, tabs);
  await p.evaluate(() => window.__hl.toolbarEl.querySelector('button').focus());
  await p.keyboard.press('ArrowRight');
  check('ArrowRight goes to the next button', (await focused(p)) === 'tb1', await focused(p));
  await p.keyboard.press('End');
  const n = tabs.length - 1;
  check('End goes to the last', (await focused(p)) === 'tb' + n, await focused(p));
  await p.keyboard.press('ArrowRight');
  check('and wraps round to the first', (await focused(p)) === 'tb0', await focused(p));
  await p.keyboard.press('ArrowLeft');
  check('ArrowLeft wraps to the last', (await focused(p)) === 'tb' + n, await focused(p));
  await p.keyboard.press('Home');
  const now = await p.evaluate(() => Array.from(window.__hl.toolbarEl.querySelectorAll('button')).map(b => b.tabIndex));
  check('the Tab stop moves with focus', (await focused(p)) === 'tb0' && now[0] === 0 && now.filter(t => t === 0).length === 1, now);
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  const w = await L.wr(p);
  check('Enter on a button applies it (the second: magenta)', w.length === 1 && w[0].k === 'h4', w);
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

async function editor(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  await L.selStr(p, '#p1', 'Plain words'); await L.altKey(p, 'n'); await p.waitForTimeout(200);
  const seq = [await focused(p)];
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); seq.push(await focused(p)); }
  check('Tab goes round the editor and never leaves it', seq[0] === 'input' && !seq.includes('after') && !seq.includes(null) && seq[3] === 'input', seq);   // Save is disabled with nothing to save, so it is skipped
  await p.keyboard.press('Shift+Tab');
  const back = await focused(p);
  check('Shift+Tab from the first button goes back round to the note', seq[4] !== 'input' && back === 'input', { at: seq[4], back });
  check('the editor is still open', await p.evaluate(() => !!window.__hl.editor), null);
  await ctx.close();
}

// Alt+P, N, V, J and L have no Shift variant: with Shift held they do nothing, and without it they act.
async function shifted(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  await L.selStr(p, '#p1', 'Plain words'); await L.altKey(p, '1');
  await L.selStr(p, '#p1', 'Plain words');
  const state = () => p.evaluate(() => ({ pen: window.__hl.penKey || null, editor: !!window.__hl.editor, hidden: window.__hl.annotationsHidden, jump: window.__hl.jumpGroup || null }));
  const before = await state();
  for (const k of ['p', 'n', 'v', 'j', 'l']) await L.altKey(p, k, true);
  check('Alt+Shift+P, N, V, J and L change nothing', JSON.stringify(await state()) === JSON.stringify(before), [before, await state()]);
  check('Alt+Shift+L shows no toast', (await L.toast(p)) === null, await L.toast(p));
  await L.altKey(p, 'p');
  check('Alt+P turns the pen on', (await state()).pen !== null, await state());
  await L.altKey(p, 'p');
  await L.altKey(p, 'v');
  check('Alt+V hides the annotations', (await state()).hidden === true, await state());
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([toolbar, editor, shifted].map(f => f(browser).catch(e => check(`${f.name} crashed`, false, e.stack))));
  await L.done(browser);
})();
