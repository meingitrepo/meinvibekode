// 9.43: Alt+Shift+H lists the shortcuts, Alt+Shift+W shows the release changelog; Esc closes, Alt+Shift+K off silences both.
const L = require('./lib');
const HTML = '<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:16px/1.5 serif;margin:40px"><p>some text</p></body></html>';
const check = L.check;
const state = p => p.evaluate(() => { const h = window.__hl.helpEl; return h.hidden ? null : { title: h.querySelector('.panel-count').textContent, text: h.querySelector('.help-body').textContent }; });
(async () => {
  const browser = await L.launch();
  const { ctx, page: p } = await L.open(browser, { html: HTML, store: { 'rnh:settings': JSON.stringify({ disabled: [] }) } });
  await L.altKey(p, 'h', true);
  let s = await state(p);
  check('Alt+Shift+H opens the shortcut guide', !!s && /Shortcuts/.test(s.title), JSON.stringify(s));
  check('the guide lists Alt+Shift+O, Alt+Shift+W and Alt+Shift+H', !!s && ['Alt+Shift+O', 'Alt+Shift+W', 'Alt+Shift+H', 'Alt+Z'].every(k => s.text.includes(k)), s && s.text);
  await L.altKey(p, 'h', true);
  check('Alt+Shift+H again closes it', await state(p) === null, null);
  await L.altKey(p, 'w', true);
  s = await state(p);
  check('Alt+Shift+W opens the changelog', !!s && /What's new/.test(s.title) && /\d+\.\d+/.test(s.text), JSON.stringify(s));
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  check('Esc closes it', await state(p) === null, null);
  await L.altKey(p, 'k', true);
  await L.altKey(p, 'h', true);
  check('with the shortcuts switched off Alt+Shift+H does nothing', await state(p) === null, null);
  await ctx.close(); await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
