// 8.29: while our keys are on, every Alt key outside a field is ours alone: the site's access
// keys (Wikipedia's) and its own Alt handlers never run. Alt+Shift+K turns our keys off, and the
// site gets its Alt keys back. Chrome fires access keys before any keydown handler, so the keys
// are sent as Chrome gets them from a real keyboard (with text), not as Playwright's
// keyboard.press sends them (no text, no access keys).
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
  await alt(p, 'z', true);
  await alt(p, 'h');
  await alt(p, 'n');
  await alt(p, 'd', true);
  await alt(p, 'u');
  check('keys on: no site Alt key runs, used by us or not', (await site(p)).length === 0 && (await L.wr(p)).length === 0, null);
  await alt(p, 'f');
  check('nor a field\'s access key', await p.evaluate(() => document.activeElement.id) !== 'f', null);
  check('the access keys are back after Alt is let go', await p.evaluate(() => document.querySelectorAll('[accesskey]').length) === 6, null);
  await p.click('#f'); await p.keyboard.type('ab');
  await alt(p, 'u');
  check('in a field the site\'s own Alt handlers still run', JSON.stringify(await site(p)) === '["js U"]', null);
  await p.evaluate(() => document.activeElement.blur());

  await L.selStr(p, '#p1', 'Plain words');
  await alt(p, 'h');
  const w = await L.wr(p);
  check('text selected: Alt+H highlights', w.length === 1 && w[0].k === 'h' && (await site(p)).length === 0, w);
  await alt(p, 'z');
  check('Alt+Z undoes', (await L.wr(p)).length === 0 && (await site(p)).length === 0, null);
  await alt(p, 'o');
  check('Alt+O opens the panel', await p.evaluate(() => !window.__hl.panelEl.hidden) && (await site(p)).length === 0, null);
  await alt(p, 'o');

  await alt(p, 'k', true);
  check('Alt+Shift+K turns our keys off, saying so', /Shortcut keys off/.test(await L.toast(p) || '') && !JSON.parse(await p.evaluate(() => window.__gm['rnh:settings'])).keysOnSites.includes('example.test'), await L.toast(p));
  await alt(p, 'z');
  await alt(p, 'u');
  check('keys off: the site\'s access keys and Alt handlers run', JSON.stringify(await site(p)) === '["main","js U"]', null);
  await L.selStr(p, '#p1', 'Plain words');
  await alt(p, 'h');
  check('and ours do nothing', (await L.wr(p)).length === 0 && JSON.stringify(await site(p)) === '["history"]', null);
  await alt(p, 'k', true);
  check('Alt+Shift+K turns them on again', /Shortcut keys on/.test(await L.toast(p) || ''), await L.toast(p));
  await site(p);
  await alt(p, 'h');
  check('and Alt+H highlights again', (await L.wr(p)).length === 1 && (await site(p)).length === 0, null);
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
