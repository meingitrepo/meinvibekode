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
  await L.done(browser);
})();
