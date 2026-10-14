// 7.54: the toolbar of selected annotations stays shown while they are restyled and redrawn.
const L = require('./lib');
const html = `<html><body style="font:16px sans-serif;margin:40px;padding-top:120px">
<p id="p">Alpha bravo charlie delta echo foxtrot golf hotel india juliet.</p>
<p id="q">Second paragraph kilo lima mike november oscar papa.</p></body></html>`;
(async () => {
  const b = await L.launch();
  const { page } = await L.open(b, { html });
  await L.selStr(page, '#p', 'bravo', { endStr: 'echo' }); await L.altKey(page, 'KeyH');
  await L.selStr(page, '#q', 'kilo', { endStr: 'mike' }); await L.altKey(page, 'KeyH');
  await page.evaluate(() => getSelection().removeAllRanges()); await page.mouse.move(900, 650); await page.waitForTimeout(300);
  const pt = sel => page.evaluate(s => { const w = window.__hl.allWrappers().find(w => w.closest(s)); const r = w.getClientRects()[0]; return { x: r.left + 5, y: r.top + r.height / 2 }; }, sel);
  // Records whether the toolbar was hidden in any frame from now on.
  const watch = () => page.evaluate(() => { window.__hid = 0; window.__watch = true; const f = () => { if (!window.__watch) return; if (window.__hl.toolbarEl.hidden) window.__hid++; requestAnimationFrame(f); }; f(); });
  const stop = () => page.evaluate(() => { window.__watch = false; return window.__hid; });
  const labels = async () => { const t = await L.toolbar(page); return t && t.buttons.map(x => x.label + (x.pressed === 'true' ? '*' : '')); };
  const press = l => page.evaluate(l => Array.from(window.__hl.toolbarEl.querySelectorAll('button')).find(b => b.dataset.label === l).click(), l);
  const p = await pt('#p');
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(350);
  L.check('toolbar shown', !!(await L.toolbar(page)), null);
  await watch(); await press('Cyan highlight'); await page.waitForTimeout(500);
  let hid = await stop();
  L.check('button restyle: toolbar never hidden', hid === 0, hid);
  L.check('button restyle: green pressed', ((await labels()) || []).includes('Remove cyan highlight*'), await labels());
  await watch(); await page.keyboard.press('KeyU'); await page.waitForTimeout(500);   // underline, no Alt
  hid = await stop();
  let w = await L.wr(page);
  L.check('key restyle applied', w.filter(x => x.k !== 'h').length > 0, w);
  L.check('key restyle: toolbar never hidden', hid === 0, hid);
  const lab = await labels();
  L.check('key restyle: toolbar shows the new style pressed', lab && lab.some(x => x.endsWith('*') && !/cyan/.test(x)), lab);
  // multi: Ctrl+click the second, restyle both by key
  const q = await pt('#q');
  await page.keyboard.down('Control'); await page.mouse.click(q.x, q.y); await page.keyboard.up('Control'); await page.waitForTimeout(350);
  await watch(); await page.keyboard.press('KeyS'); await page.waitForTimeout(500);
  hid = await stop();
  L.check('multi key restyle: toolbar never hidden', hid === 0, hid);
  L.check('multi: both still selected', (await page.evaluate(() => window.__hl.selectedGroups.length)) === 2, null);
  // the style both have removes them: toolbar goes, as it should
  await page.keyboard.press('KeyS'); await page.waitForTimeout(400);
  L.check('removing hides toolbar', !(await L.toolbar(page)) && (await L.wr(page)).length === 0, null);
  L.check('no page errors', page.__errors.length === 0, page.__errors);
  await b.close();
  console.log(L.fails ? `${L.fails} FAILED` : 'ALL PASS'); process.exit(L.fails ? 1 : 0);
})();
