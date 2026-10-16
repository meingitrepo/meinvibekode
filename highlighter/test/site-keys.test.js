// 8.28: Alt keys a site uses too (access keys like Wikipedia's, its own Alt handlers) do one
// thing: ours when it has something to act on, else the site's, never both. Chrome fires access
// keys before any keydown handler, so the keys are sent as Chrome gets them from a real keyboard
// (with text), not as Playwright's keyboard.press sends them (no text, no access keys).
const L = require('./lib');
const results = [];
const check = (name, ok, info) => results.push([name, ok, info]);
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px">
<p id="p1">Plain words to mark in the first paragraph here.</p>
<a href="#" accesskey="z">main</a> <a href="#" accesskey="h">history</a> <a href="#" accesskey="d">delete</a>
<a href="#" accesskey="n">talk</a> <a href="#" accesskey="o">log in</a> <input id="f" accesskey="f">
<script>window.site = []; document.addEventListener("click", e => { if (e.target.tagName === "A") { e.preventDefault(); site.push(e.target.textContent); } });
document.addEventListener('keydown', e => { if (e.altKey && e.code === 'KeyU') site.push('js U'); });</script></body></html>`;

// Alt (and Shift) down, the letter as Chrome gets it from the keyboard, then up again.
async function alt(p, letter, shift) {
  const c = p.__cdp || (p.__cdp = await p.context().newCDPSession(p));
  const mods = 1 | (shift ? 8 : 0), up = letter.toUpperCase(), code = 'Key' + up, vk = up.charCodeAt(0);
  const text = shift ? up : letter;
  await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: 1, key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18 });
  if (shift) await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers: mods, key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: mods, key: text, code, windowsVirtualKeyCode: vk, text, unmodifiedText: letter });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: mods, key: text, code, windowsVirtualKeyCode: vk });
  if (shift) await c.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 1, key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 0, key: 'Alt', code: 'AltLeft', windowsVirtualKeyCode: 18 });
  await p.waitForTimeout(150);
}
const site = p => p.evaluate(() => window.site.splice(0));

async function run(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  await alt(p, 'z');
  check('nothing to undo: Alt+Z is the site\'s', JSON.stringify(await site(p)) === '["main"]', null);
  await alt(p, 'z', true);
  check('Alt+Shift+Z too', JSON.stringify(await site(p)) === '["main"]', null);
  await alt(p, 'h');
  check('nothing selected or pointed: Alt+H is the site\'s', JSON.stringify(await site(p)) === '["history"]' && (await L.wr(p)).length === 0, null);
  await alt(p, 'n');
  check('Alt+N is the site\'s, without our hint', JSON.stringify(await site(p)) === '["talk"]' && !(await L.toast(p)), await L.toast(p));
  await alt(p, 'd', true);
  check('no annotations: Alt+Shift+D is the site\'s', JSON.stringify(await site(p)) === '["delete"]', null);
  await alt(p, 'f');
  check('a field\'s access key focuses it, as Chrome does', await p.evaluate(() => document.activeElement.id) === 'f', null);
  await p.evaluate(() => document.activeElement.blur());
  check('the access keys are back after Alt is let go', await p.evaluate(() => document.querySelectorAll('[accesskey]').length) === 6, null);

  await L.selStr(p, '#p1', 'Plain words');
  await alt(p, 'h');
  const w = await L.wr(p);
  check('text selected: Alt+H highlights, the site\'s key stays out', w.length === 1 && w[0].k === 'h' && (await site(p)).length === 0, w);
  await L.selStr(p, '#p1', 'first paragraph');
  await alt(p, 'u');
  check('Alt+U underlines; the site\'s own Alt+U handler isn\'t also run', (await L.wr(p)).length === 2 && (await site(p)).length === 0, null);
  await alt(p, 'z');
  check('something to undo: Alt+Z undoes, and only that', (await L.wr(p)).length === 1 && (await site(p)).length === 0, null);
  await alt(p, 'o');
  check('Alt+O opens the panel, not the site\'s log in', await p.evaluate(() => !window.__hl.panelEl.hidden) && (await site(p)).length === 0, null);
  await alt(p, 'o');
  await p.mouse.move(5, 5);
  await alt(p, 'u');
  check('nothing selected: Alt+U goes to the site\'s handler', JSON.stringify(await site(p)) === '["js U"]', null);
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await run(browser).catch(e => check('crashed', false, e.stack));
  await browser.close();
  let fails = 0;
  results.forEach(([name, ok, info]) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' :: ' + JSON.stringify(info)}`); if (!ok) fails++; });
  console.log(`FAILS ${fails}`);
  process.exit(fails);
})();
