// Visibility (Alt+V) is remembered per site; turning the selection toolbar on shows annotations;
// the pen and the selection toolbar exclude each other, and the toolbar's button stays clickable.
const L = require('./lib');
const { check } = L;
const HTML = '<p id="t">Alpha bravo charlie delta echo</p>';
const SITE = 'example.test';
const hid = p => p.evaluate(() => window.__hl.annotationsHidden);
const pen = p => p.evaluate(() => window.__hl.penKey);
const shownSites = p => p.evaluate(() => JSON.parse(window.__gm['rnh:settings'] || '{}').annotationsShownSites || []);
const seeded = sites => ({ 'rnh:settings': JSON.stringify({ toolbarOnSites: [SITE], keysOnSites: [SITE], annotationsShownSites: sites }) });

async function remembered(browser) {
  let { ctx, page: p } = await L.open(browser, { html: HTML, hiddenDefault: true });
  check('a site never switched: hidden', (await hid(p)) === true);
  await L.altKey(p, 'v');
  check('Alt+V shows them and remembers the site', (await hid(p)) === false && (await shownSites(p)).includes(SITE), await shownSites(p));
  await L.altKey(p, 'v');
  check('Alt+V hides them and forgets the site', (await hid(p)) === true && !(await shownSites(p)).includes(SITE), await shownSites(p));
  await p.evaluate(() => window.__hl.openPanel());
  check('the panel shows them for a while', (await hid(p)) === false);
  check('without remembering that', !(await shownSites(p)).includes(SITE), await shownSites(p));
  await ctx.close();

  ({ ctx, page: p } = await L.open(browser, { html: HTML, hiddenDefault: true, store: seeded([SITE]) }));
  check('a remembered site opens shown', (await hid(p)) === false);
  await ctx.close();

  ({ ctx, page: p } = await L.open(browser, { html: HTML, hiddenDefault: true, store: seeded(['other.test']) }));
  check('another site\'s choice does not count here', (await hid(p)) === true);
  await ctx.close();
}

async function toolbarShows(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, hiddenDefault: true, store: { 'rnh:settings': JSON.stringify({ keysOnSites: [SITE], toolbarOnSites: [] }) } });
  check('starts hidden with the toolbar off', (await hid(p)) === true);
  await L.altKey(p, 't');
  check('toolbar on also shows annotations', (await hid(p)) === false);
  check('and that is remembered', (await shownSites(p)).includes(SITE), await shownSites(p));
  await L.altKey(p, 't');
  check('toolbar off leaves them shown', (await hid(p)) === false);
  await ctx.close();
}

async function exclusive(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML, menu: true });
  const state = () => p.evaluate(() => { const b = window.__hl.menuButtons.get('toolbar'); return { disabled: b.disabled, pressed: b.getAttribute('aria-pressed'), icon: window.__hl.iconName(b) }; });
  await L.altKey(p, 'p');
  let s = await state();
  check('pen on: toolbar shows as off, not grayed out', s.disabled === false && s.pressed === 'false' && s.icon === 'cursor-text-slash', s);
  await L.altKey(p, 't');
  s = await state();
  check('toolbar on turns the pen off', !(await pen(p)) && s.pressed === 'true' && s.icon === 'cursor-text', s);
  check('and says the toolbar is enabled', (await L.toast(p)) === 'Selection toolbar enabled', await L.toast(p));
  await L.altKey(p, 'p');
  await p.evaluate(() => window.__hl.menuButtons.get('toolbar').click());
  check('the menu button does the same', !(await pen(p)) && (await state()).pressed === 'true', await state());
  await L.altKey(p, 'p');
  await L.altKey(p, 'p');
  check('pen off puts the toolbar back as it was', (await state()).pressed === 'true', await state());
  await L.altKey(p, 't');
  await L.altKey(p, 'p');
  await L.altKey(p, 'p');
  check('a toolbar switched off stays off after the pen', (await state()).pressed === 'false', await state());
  check('no page errors', p.__errors.length === 0, p.__errors);
  await ctx.close();
}

async function noteFooter(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  check('the note editor has no key hint', !(await p.evaluate(() => /Enter to save|Esc to cancel/.test(window.__hl.editorEl.textContent))));
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([remembered, toolbarShows, exclusive, noteFooter]
    .map(f => f(browser).catch(e => check(`${f.name} crashed`, false, e.stack))));
  await L.done(browser);
})();
