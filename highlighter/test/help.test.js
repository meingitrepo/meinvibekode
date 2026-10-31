// Alt+Shift+H lists the shortcuts; Esc closes; Alt+Shift+K off silences it. The Alt+Shift+W What's new panel is retired.
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
  check('the guide lists Alt+Shift+O and Alt+Shift+H but no longer Alt+Shift+W', !!s && ['Alt+Shift+O', 'Alt+Shift+H', 'Alt+Z'].every(k => s.text.includes(k)) && !s.text.includes('Alt+Shift+W'), s && s.text);
  await L.altKey(p, 'h', true);
  check('Alt+Shift+H again closes it', await state(p) === null, null);
  await L.altKey(p, 'h', true);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  check('Esc closes the guide', await state(p) === null, null);
  await L.altKey(p, 'w', true);
  check('Alt+Shift+W does nothing (the What\'s new panel is retired)', await state(p) === null, null);
  await L.altKey(p, 'k', true);
  await L.altKey(p, 'h', true);
  check('with the shortcuts switched off Alt+Shift+H does nothing', await state(p) === null, null);
  await ctx.close();
  // Retired: an update no longer opens anything by itself and no longer touches the saved version.
  const r = await L.open(browser, { html: HTML, store: { 'rnh:settings': JSON.stringify({ disabled: [], changelogVersion: '9.98' }) } });
  await r.page.waitForTimeout(4800);
  check('an update opens nothing by itself', await state(r.page) === null, null);
  const saved = await r.page.evaluate(() => JSON.parse(window.__gm['rnh:settings']).changelogVersion);
  check('and leaves the old changelogVersion key untouched', saved === '9.98', saved);
  await r.ctx.close();
  await browser.close();
  console.log('FAILS', L.fails);
})().catch(e => { console.error(e); process.exit(1); });
