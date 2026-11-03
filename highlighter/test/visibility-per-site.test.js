// Visibility (Alt+V) is remembered per site.
const L = require('./lib');
const { check } = L;
const HTML = '<p id="t">Alpha bravo charlie delta echo</p>';
const SITE = 'example.test';
const hid = p => p.evaluate(() => window.__hl.annotationsHidden);
const shownSites = p => p.evaluate(() => JSON.parse(window.__gm['rnh:settings'] || '{}').annotationsShownSites || []);
const seeded = sites => ({ 'rnh:settings': JSON.stringify({ keysOnSites: [SITE], annotationsShownSites: sites }) });

async function remembered(browser) {
  let { ctx, page: p } = await L.open(browser, { html: HTML, hiddenDefault: true });
  check('a site never switched: hidden', (await hid(p)) === true);
  await L.altKey(p, 'v');
  check('Alt+V shows them and remembers the site', (await hid(p)) === false && (await shownSites(p)).includes(SITE), await shownSites(p));
  await L.selStr(p, '#t', 'bravo'); await L.altKey(p, 'h');   // Alt+V does nothing on a page with nothing to hide
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


async function noteFooter(browser) {
  const { ctx, page: p } = await L.open(browser, { html: HTML });
  check('the note editor has no key hint', !(await p.evaluate(() => /Enter to save|Esc to cancel/.test(window.__hl.editorEl.textContent))));
  await ctx.close();
}

(async () => {
  const browser = await L.launch();
  await Promise.all([remembered, noteFooter]
    .map(f => f(browser).catch(e => check(`${f.name} crashed`, false, e.stack))));
  await L.done(browser);
})();
