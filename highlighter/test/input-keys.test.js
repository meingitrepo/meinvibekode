// Input fixes: the shortcut guide traps Tab and gives focus back on Esc; a pointer released over an
// iframe or outside the window no longer counts as held; an Alt key reaches the site unless we acted on it.
const L = require('./lib');
const check = L.check;
const HTML = `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body style="font:18px/1.6 serif;margin:40px">
<p id="p1">Plain words to mark in the first paragraph here.</p><button id="b">page button</button><button id="b2">other</button>
<iframe id="fr" style="position:fixed;right:20px;bottom:20px;width:200px;height:120px" srcdoc="<body>frame</body>"></iframe>
<script>window.site = [];  document.addEventListener('keydown', e => { if (e.altKey) site.push('down ' + e.code); });
document.addEventListener('keyup', e => { if (e.altKey || e.key === 'Alt') site.push('up ' + e.code); });</script></body></html>`;
const down = p => p.evaluate(() => window.__hl.pointerIsDown);
const inside = p => p.evaluate(() => { const a = window.__hl.uiRoot.activeElement; return !!a && window.__hl.helpEl.contains(a) && document.activeElement === window.__hl.uiHost; });

(async () => {
  const browser = await L.launch();
  const { ctx, page: p } = await L.open(browser, { html: HTML });

  // After ours on window, in the capture phase: what the script made of the key.
  await p.evaluate(() => { window.tabs = []; window.addEventListener('keydown', e => { if (e.key === 'Tab') window.tabs.push(e.defaultPrevented); }, true); });
  // (a) Tab trap and focus return in the shortcut guide.
  await p.focus('#b');
  await L.altKey(p, 'h', true);
  check('the guide opens with focus inside', await inside(p), null);
  for (const shift of [false, true, false]) {
    if (shift) await p.keyboard.down('Shift');
    await p.keyboard.press('Tab');
    if (shift) await p.keyboard.up('Shift');
    check(`Tab${shift ? ' backwards' : ''} stays in the guide`, await inside(p) && (await p.evaluate(() => window.tabs.pop())) === true, null);
  }
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  check('Esc gives focus back to the page button', await p.evaluate(() => document.activeElement.id) === 'b', null);

  // (b) A release over an iframe or outside the window.
  const t = await p.evaluate(() => { const r = document.getElementById('p1').getBoundingClientRect(); return { x: r.left + 20, y: r.top + 10 }; });
  await p.mouse.move(t.x, t.y);
  await p.mouse.down();
  check('pressing the mouse counts as held', await down(p) === true, null);
  await p.mouse.move(1000, 640);
  await p.mouse.up();
  check('released over an iframe: not held after the pointer moves back', (await p.mouse.move(t.x, t.y), await p.waitForTimeout(50), await down(p)) === false, await down(p));
  await p.mouse.down();
  await p.evaluate(() => window.dispatchEvent(new Event('blur')));
  check('the window losing focus ends the hold', await down(p) === false, null);
  await p.mouse.up();
  await p.mouse.down();
  await p.mouse.move(t.x + 30, t.y);
  check('a real drag keeps the hold', await down(p) === true, null);
  await p.mouse.up();
  check('a normal release ends it', await down(p) === false, null);

  // (c) Alt keys: only ours are kept from the site.
  await p.evaluate(() => { window.site.length = 0; document.activeElement.blur(); });
  await L.altKey(p, 'q');
  const s1 = await p.evaluate(() => window.site.splice(0));
  check('an Alt key we do nothing with reaches the site', s1.includes('down KeyQ'), s1);
  await L.selStr(p, '#p1', 'Plain words');
  await L.altKey(p, 'h');
  const s2 = await p.evaluate(() => window.site.splice(0));
  check('Alt+H we acted on stays away from the site', !s2.some(x => /KeyH/.test(x)) && (await L.wr(p)).length === 1, s2);

  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
  await L.done(browser);
})();
