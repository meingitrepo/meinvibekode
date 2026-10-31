// 9.43: a page opens with annotations hidden (menu bar still there); the panel and the pen show them
// while open and put them back, unless the user changed visibility meanwhile.
const L = require('./lib');
const { check } = L;
const HTML = '<p id="t">Alpha bravo charlie delta echo</p>';
const hid = p => p.evaluate(() => window.__hl.annotationsHidden);

(async () => {
  const browser = await L.launch();
  const { page: p } = await L.open(browser, { html: HTML, hiddenDefault: true, menu: true });
  check('new page: annotations hidden', (await hid(p)) === true);
  check('new page: menu bar visible', await p.evaluate(() => !window.__hl.menuEl.hidden));

  await L.selStr(p, '#t', 'bravo'); await L.altKey(p, 'h');
  check('shortcut highlight shows annotations', (await hid(p)) === false && (await L.wr(p)).length === 1);

  await p.evaluate(() => window.__hl.setAnnotationsHidden(true));
  await p.evaluate(() => window.__hl.openPanel());
  check('panel open shows them', (await hid(p)) === false);
  await p.evaluate(() => window.__hl.closePanel());
  check('panel close restores hidden', (await hid(p)) === true);

  await p.evaluate(() => window.__hl.setAnnotationsHidden(false));
  await p.evaluate(() => { window.__hl.openPanel(); window.__hl.closePanel(); });
  check('panel close leaves them shown if they were', (await hid(p)) === false);

  await p.evaluate(() => window.__hl.setAnnotationsHidden(true));
  await L.altKey(p, 'p');
  check('pen on shows them', (await hid(p)) === false && !!(await p.evaluate(() => window.__hl.penKey)));
  await L.altKey(p, 'p');
  check('pen off restores hidden', (await hid(p)) === true);

  await L.altKey(p, 'p');
  await L.altKey(p, 'v');
  check('hiding with Alt+V turns the pen off', (await hid(p)) === true && !(await p.evaluate(() => window.__hl.penKey)));

  await p.evaluate(() => window.__hl.openPanel());
  const mid = []; await p.evaluate(() => { window.__hl.setAnnotationsHidden(true); window.__hl.setAnnotationsHidden(false); });
  await p.evaluate(() => window.__hl.closePanel());
  check('user toggling while panel open wins over the restore', (await hid(p)) === false);
  // menu: panel and search buttons toggle and show pressed; the toolbar button shows off while the pen is on
  const btn = (id, a) => p.evaluate(([id, a]) => { const b = [...window.__hl.menuEl.querySelectorAll('button')].find(x => x.dataset.label === id); return a === 'p' ? b.getAttribute('aria-pressed') : b.disabled; }, [id, a]);
  await p.evaluate(() => window.__hl.menuEl.dispatchEvent(new Event('pointerenter')));
  await p.evaluate(() => { const m = window.__hl.menuEl; m.querySelector('.sitemenu-expand button').click(); });
  const click = id => p.evaluate(id => [...window.__hl.menuEl.querySelectorAll('button')].find(x => x.dataset.label === id).click(), id);
  await click('Annotations');
  check('menu: Annotations pressed while panel open', (await btn('Annotations', 'p')) === 'true' && !(await p.evaluate(() => window.__hl.panelEl.hidden)));
  await click('Annotations');
  check('menu: second click closes the panel', (await btn('Annotations', 'p')) === 'false' && (await p.evaluate(() => window.__hl.panelEl.hidden)));
  await click('Search all pages');
  check('menu: Search pressed while open', (await btn('Search all pages', 'p')) === 'true');
  await click('Search all pages');
  check('menu: second click closes search', (await btn('Search all pages', 'p')) === 'false' && (await p.evaluate(() => window.__hl.everythingEl.hidden)));
  await p.evaluate(() => window.__hl.setAnnotationsHidden(false));
  await p.evaluate(() => window.__hl.openPanel());
  await click('Hide annotations');
  check('hiding annotations closes the panel', (await hid(p)) === true && (await p.evaluate(() => window.__hl.panelEl.hidden)));
  await L.altKey(p, 'p');
  check('pen on: menu toolbar button not pressed, still clickable', (await btn('Selection toolbar', 'd')) === false && (await btn('Selection toolbar', 'p')) === 'false');
  await L.altKey(p, 'p');
  check('pen off: toolbar button pressed again', (await btn('Selection toolbar', 'p')) === 'true');
  await L.done(browser);
})();
